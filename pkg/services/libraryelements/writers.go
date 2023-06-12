package libraryelements

import (
	"bytes"
	"errors"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

type Pair struct {
	key   string
	value interface{}
}

func selectLibraryElementByParam(params []Pair) (string, []interface{}) {
	conditions := make([]string, 0, len(params))
	values := make([]interface{}, 0, len(params))
	for _, p := range params {
		conditions = append(conditions, "le."+p.key+"=?")
		values = append(values, p.value)
	}
	return ` WHERE ` + strings.Join(conditions, " AND "), values
}

func writeParamSelectorSQL(builder *db.SQLBuilder, params ...Pair) {
	if len(params) > 0 {
		conditionString, paramValues := selectLibraryElementByParam(params)
		builder.Write(conditionString, paramValues...)
	}
}

func writePerPageSQL(query model.SearchLibraryElementsQuery, sqlStore db.DB, builder *db.SQLBuilder) {
	if query.PerPage != 0 {
		offset := query.PerPage * (query.Page - 1)
		builder.Write(sqlStore.GetDialect().LimitOffset(int64(query.PerPage), int64(offset)))
	}
}

func writeKindSQL(query model.SearchLibraryElementsQuery, builder *db.SQLBuilder) {
	if model.LibraryElementKind(query.Kind) == model.PanelElement || model.LibraryElementKind(query.Kind) == model.VariableElement {
		builder.Write(" AND le.kind = ?", query.Kind)
	}
}

func writeTypeFilterSQL(typeFilter []string, builder *db.SQLBuilder) {
	if len(typeFilter) > 0 {
		var sql bytes.Buffer
		params := make([]interface{}, 0)
		sql.WriteString(` AND le.type IN (?` + strings.Repeat(",?", len(typeFilter)-1) + ")")
		for _, filter := range typeFilter {
			params = append(params, filter)
		}
		builder.Write(sql.String(), params...)
	}
}

func writeSearchStringSQL(query model.SearchLibraryElementsQuery, sqlStore db.DB, builder *db.SQLBuilder) {
	if len(strings.TrimSpace(query.SearchString)) > 0 {
		builder.Write(" AND (le.name "+sqlStore.GetDialect().LikeStr()+" ?", "%"+query.SearchString+"%")
		builder.Write(" OR le.description "+sqlStore.GetDialect().LikeStr()+" ?)", "%"+query.SearchString+"%")
	}
}

func writeExcludeSQL(query model.SearchLibraryElementsQuery, builder *db.SQLBuilder) {
	if len(strings.TrimSpace(query.ExcludeUID)) > 0 {
		builder.Write(" AND le.uid <> ?", query.ExcludeUID)
	}
}

type FolderFilter struct {
	includeGeneralFolder bool
	folderIDs            []string
	folderUIDs           []string
	parseError           error
}

func parseFolderFilter(query model.SearchLibraryElementsQuery) FolderFilter {
	folderIDs := make([]string, 0)
	folderUIDs := make([]string, 0)
	hasFolderFilter := len(strings.TrimSpace(query.FolderFilter)) > 0
	hasFolderFilterUID := len(strings.TrimSpace(query.FolderFilterUIDs)) > 0

	result := FolderFilter{
		includeGeneralFolder: true,
		folderIDs:            folderIDs,
		folderUIDs:           folderUIDs,
		parseError:           nil,
	}

	if hasFolderFilter && hasFolderFilterUID {
		result.parseError = errors.New("cannot pass both folderFilter and folderFilterUIDs")
		return result
	}

	if hasFolderFilter {
		result.includeGeneralFolder = false
		folderIDs = strings.Split(query.FolderFilter, ",")
		result.folderIDs = folderIDs
		for _, filter := range folderIDs {
			folderID, err := strconv.ParseInt(filter, 10, 64)
			if err != nil {
				result.parseError = err
			}
			if isGeneralFolder(folderID) {
				result.includeGeneralFolder = true
				break
			}
		}
	}

	if hasFolderFilterUID {
		result.includeGeneralFolder = false
		folderUIDs = strings.Split(query.FolderFilterUIDs, ",")
		result.folderUIDs = folderUIDs

		for _, folderUID := range folderUIDs {
			if isUIDGeneralFolder(folderUID) {
				result.includeGeneralFolder = true
				break
			}
		}
	}

	return result
}

func (f *FolderFilter) writeFolderFilterSQL(includeGeneral bool, builder *db.SQLBuilder) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)
	for _, filter := range f.folderIDs {
		folderID, err := strconv.ParseInt(filter, 10, 64)
		if err != nil {
			return err
		}
		if !includeGeneral && isGeneralFolder(folderID) {
			continue
		}
		params = append(params, filter)
	}
	if len(params) > 0 {
		sql.WriteString(` AND le.folder_id IN (?` + strings.Repeat(",?", len(params)-1) + ")")
		builder.Write(sql.String(), params...)
	}

	paramsUIDs := make([]interface{}, 0)
	for _, folderUID := range f.folderUIDs {
		if !includeGeneral && isUIDGeneralFolder(folderUID) {
			continue
		}
		paramsUIDs = append(paramsUIDs, folderUID)
	}
	if len(paramsUIDs) > 0 {
		sql.WriteString(` AND dashboard.uid IN (?` + strings.Repeat(",?", len(paramsUIDs)-1) + ")")
		builder.Write(sql.String(), paramsUIDs...)
	}

	return nil
}
