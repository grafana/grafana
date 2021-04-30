package librarypanels

import (
	"bytes"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func writePerPageSQL(query searchLibraryPanelsQuery, sqlStore *sqlstore.SQLStore, builder *sqlstore.SQLBuilder) {
	if query.perPage != 0 {
		offset := query.perPage * (query.page - 1)
		builder.Write(sqlStore.Dialect.LimitOffset(int64(query.perPage), int64(offset)))
	}
}

func writePanelFilterSQL(panelFilter []string, builder *sqlstore.SQLBuilder) {
	if len(panelFilter) > 0 {
		var sql bytes.Buffer
		params := make([]interface{}, 0)
		sql.WriteString(` AND lp.type IN (?` + strings.Repeat(",?", len(panelFilter)-1) + ")")
		for _, filter := range panelFilter {
			params = append(params, filter)
		}
		builder.Write(sql.String(), params...)
	}
}

func writeSearchStringSQL(query searchLibraryPanelsQuery, sqlStore *sqlstore.SQLStore, builder *sqlstore.SQLBuilder) {
	if len(strings.TrimSpace(query.searchString)) > 0 {
		builder.Write(" AND (lp.name "+sqlStore.Dialect.LikeStr()+" ?", "%"+query.searchString+"%")
		builder.Write(" OR lp.description "+sqlStore.Dialect.LikeStr()+" ?)", "%"+query.searchString+"%")
	}
}

func writeExcludeSQL(query searchLibraryPanelsQuery, builder *sqlstore.SQLBuilder) {
	if len(strings.TrimSpace(query.excludeUID)) > 0 {
		builder.Write(" AND lp.uid <> ?", query.excludeUID)
	}
}

type FolderFilter struct {
	includeGeneralFolder bool
	folderIDs            []string
	parseError           error
}

func parseFolderFilter(query searchLibraryPanelsQuery) FolderFilter {
	var folderIDs []string
	if len(strings.TrimSpace(query.folderFilter)) == 0 {
		return FolderFilter{
			includeGeneralFolder: true,
			folderIDs:            folderIDs,
			parseError:           nil,
		}
	}

	includeGeneralFolder := false
	folderIDs = strings.Split(query.folderFilter, ",")
	for _, filter := range folderIDs {
		folderID, err := strconv.ParseInt(filter, 10, 64)
		if err != nil {
			return FolderFilter{
				includeGeneralFolder: false,
				folderIDs:            folderIDs,
				parseError:           err,
			}
		}
		if isGeneralFolder(folderID) {
			includeGeneralFolder = true
			break
		}
	}

	return FolderFilter{
		includeGeneralFolder: includeGeneralFolder,
		folderIDs:            folderIDs,
		parseError:           nil,
	}
}

func (f *FolderFilter) writeFolderFilterSQL(includeGeneral bool, builder *sqlstore.SQLBuilder) error {
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
		sql.WriteString(` AND lp.folder_id IN (?` + strings.Repeat(",?", len(params)-1) + ")")
		builder.Write(sql.String(), params...)
	}

	return nil
}
