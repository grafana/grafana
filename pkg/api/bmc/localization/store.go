package localization

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type WithDbSession func(ctx context.Context, callback sqlstore.DBTransactionFunc) error

func GetLocalesJson(c *contextmodel.ReqContext, withDbSession WithDbSession, query Query) (map[string]interface{}, error) {
	language := query.Lang

	jsonData := make(map[string]interface{})

	err := withDbSession(c.Req.Context(), func(sess *sqlstore.DBSession) error {
		// check if role is valid or not
		results := make([]map[string]interface{}, 0)
		err := sess.Table("bhd_localization").
			Cols(language).
			Cols("resource_uid").
			Where("org_id in (1, ?)", query.OrgID).Find(&results)

		if err != nil {
			return err
		}

		for _, value := range results {
			if value[language] != nil {
				var js map[string]interface{}

				err = json.Unmarshal([]byte(value[language].(string)), &js)
				if err != nil {
					return err
				}
				rUid := value["resource_uid"].(string)
				jsonData[rUid] = js
			}
		}
		return nil

	})

	return jsonData, err
}

func GetLocalesJsonByUid(c *contextmodel.ReqContext, withDbSession WithDbSession, query Query) (map[string]interface{}, error) {
	language := query.Lang
	jsonData := make(map[string]interface{})

	err := withDbSession(c.Req.Context(), func(sess *sqlstore.DBSession) error {
		results := make([]map[string]interface{}, 0)
		err := sess.Table("bhd_localization").
			Where("org_id = ?", query.OrgID).
			Where("resource_uid = ?", query.ResourceUID).
			Cols(fmt.Sprintf("\"%s\"", language)).
			Find(&results)
		if err != nil {
			return err
		}
		if len(results) > 0 {
			val := results[0]
			err = json.Unmarshal([]byte(val[language].(string)), &jsonData)
			if err != nil {
				return err
			}
		}
		return nil

	})
	return jsonData, err
}

func UpdateLocalesJsonByLang(c *contextmodel.ReqContext, WithTransactionalDbSession WithDbSession, query Query) error {
	language := query.Lang

	var reqInp map[string]interface{}
	if err := web.Bind(c.Req, &reqInp); err != nil {
		return ErrBadRequest
	}

	jsonData := make(map[string]interface{})
	if val, ok := reqInp["name"].(string); ok {
		jsonData["name"] = val
	}
	jsonb, err := json.Marshal(jsonData)
	if err != nil {
		return err
	}
	jsonStr := string(jsonb)

	err = WithTransactionalDbSession(
		c.Req.Context(),
		func(sess *sqlstore.DBSession) error {
			hasRecord, err := sess.Table("bhd_localization").
				Where("org_id in (?)", query.OrgID).
				Where("resource_uid = ?", query.ResourceUID).
				Exist()
			if err != nil {
				return err
			}
			var sqlStr string
			if hasRecord {
				sqlStr = fmt.Sprintf(
					"UPDATE bhd_localization SET \"%s\" = \"%s\"::jsonb || '%s' WHERE \"org_id\" = %v and \"resource_uid\" = '%s'",
					language,
					language,
					escape(jsonStr),
					query.OrgID,
					query.ResourceUID,
				)
			} else {
				sqlStr = fmt.Sprintf("INSERT into bhd_localization (uid, org_id, resource_uid, \"%s\") values('%s', %v, '%s', '%s')", language, util.GenerateShortUID(), query.OrgID, query.ResourceUID, escape(jsonStr))
			}
			_, err = sess.Exec(sqlStr)
			return err
		},
	)
	return err
}

func UpdateLocalesJSON(c context.Context, withTransactionalDbSession WithDbSession, query Query, localesJSON LocalesJSON) {
	myLogger := log.New("locale update with save dashboard")
	err := withTransactionalDbSession(c, func(sess *sqlstore.DBSession) error {
		hasRecord, err := sess.Table("bhd_localization").
			Where("org_id = ?", query.OrgID).
			Where("resource_uid = ?", query.ResourceUID).
			Exist()
		if err != nil {
			return err
		}
		var sqlStr string
		if hasRecord {
			sqlStr = "UPDATE bhd_localization SET "
		} else {
			sqlStr = "INSERT into bhd_localization "
		}
		var runSql bool
		colStr := ""
		valStr := ""
		for key, val := range localesJSON.Locales {
			jsonb, err := json.Marshal(val)
			if err == nil {
				jsonStr := string(jsonb)
				if colStr != "" {
					colStr += ", "
				}
				if !hasRecord {
					if valStr != "" {
						valStr += ", "
					}
					colStr += fmt.Sprintf("\"%s\"", key)
					valStr += fmt.Sprintf("'%s'", escape(jsonStr))
				} else {
					colStr += fmt.Sprintf("\"%s\"=\"%s\"::jsonb || '%s'", key, key, escape(jsonStr))
				}
				runSql = true
			} else {
				myLogger.Error("json parsing error", "locale key", key)
			}
		}
		if runSql {
			if hasRecord {
				sqlStr += fmt.Sprintf(" %s WHERE \"org_id\"=%v and \"resource_uid\"='%s'", colStr, query.OrgID, query.ResourceUID)
			} else {
				sqlStr += fmt.Sprintf("(uid, org_id, resource_uid, %s) values ('%s', %v, '%s', %s)", colStr, util.GenerateShortUID(), query.OrgID, query.ResourceUID, valStr)
			}

			_, err := sess.Exec(sqlStr)
			return err
		}
		return nil
	})
	if err != nil {
		myLogger.Error("sql update failure", "error", err)
	}
}

func GetGlobalLocalesJson(c *contextmodel.ReqContext, withDbSession WithDbSession, query Query) (*GlobalLocales, error) {
	// Initialize the JSON structure with empty objects for each supported language
	jsonData := &GlobalLocales{
		Locales: map[Locale]map[string]interface{}{
			"en-US": {},
			"en-CA": {},
			"de-DE": {},
			"es-ES": {},
			"fr-CA": {},
			"fr-FR": {},
			"it-IT": {},
			"ar-AR": {},
		},
	}

	err := withDbSession(c.Req.Context(), func(sess *sqlstore.DBSession) error {
		results := make([]map[string]interface{}, 0)
		err := sess.Table("bhd_localization").
			Where("org_id = ?", query.OrgID).
			Where("resource_uid = ?", query.ResourceUID).
			Find(&results)
		if err != nil {
			return err
		}

		// If there are results, populate the locales
		if len(results) > 0 {
			val := results[0]
			// Iterate over supported languages
			for _, lang := range SupportedLanguages {
				if rawData, exists := val[string(lang)]; exists {
					jD := make(map[string]interface{})
					err = json.Unmarshal([]byte(rawData.(string)), &jD)
					if err != nil {
						return err
					}
					jsonData.Locales[lang] = jD
				}
			}
		}

		return nil
	})

	return jsonData, err
}

func UpdateGlobalLocalesJSON(c *contextmodel.ReqContext, withTransactionalDbSession WithDbSession, query Query) error {
	r := &map[Locale]GlobalPatch{}
	if err := web.Bind(c.Req, r); err != nil {
		return ErrBadRequest
	}
	reqInp := UpdateGlobalLocales{Locales: *r}
	err := withTransactionalDbSession(c.Req.Context(), func(sess *sqlstore.DBSession) error {
		hasRecord, err := sess.Table("bhd_localization").
			Where("org_id = ?", query.OrgID).
			Where("resource_uid = ?", query.ResourceUID).
			Exist()
		if err != nil {
			return err
		}
		err, _ = maxAllowedKeys(sess, query, reqInp, hasRecord)
		if err != nil {
			return err
		}

		var sqlStr string
		if hasRecord {
			sqlStr = "UPDATE bhd_localization SET "
		} else {
			sqlStr = "INSERT into bhd_localization "
		}
		var runSql bool
		colStr := ""
		valStr := ""
		for key, val := range reqInp.Locales {
			jsonb, err := json.Marshal(val.Add)
			if err == nil {
				jsonStr := ""
				if val.Add != nil {
					jsonStr = escape(string(jsonb))
				} else {
					jsonStr = "{}"
				}
				if colStr != "" {
					colStr += ", "
				}
				if !hasRecord {
					if valStr != "" {
						valStr += ", "
					}
					colStr += fmt.Sprintf("\"%s\"", key)
					valStr += fmt.Sprintf("'%s'", jsonStr)
				} else {
					removeStr := ""
					if len(val.Remove) > 0 {
						removeStr = "Array["
						for i := range val.Remove {
							removeStr += fmt.Sprintf("'%s'", escape(val.Remove[i]))
							if i < len(val.Remove)-1 {
								removeStr += ","
							}
						}
						removeStr += "]"
					}
					if removeStr != "" {
						colStr += fmt.Sprintf("\"%s\"=(\"%s\"::jsonb || '%s') - %s", key, key, jsonStr, removeStr)
					} else {
						colStr += fmt.Sprintf("\"%s\"=(\"%s\"::jsonb || '%s')", key, key, jsonStr)
					}

				}
				runSql = true
			}
		}
		if runSql {
			if hasRecord {
				sqlStr += fmt.Sprintf(" %s WHERE \"org_id\"=%v and \"resource_uid\"='%s'", colStr, query.OrgID, query.ResourceUID)
			} else {
				sqlStr += fmt.Sprintf("(uid, org_id, resource_uid, %s) values ('%s', %v, '%s', %s)", colStr, util.GenerateShortUID(), query.OrgID, query.ResourceUID, valStr)
			}

			_, err := sess.Exec(sqlStr)
			return err
		}
		return nil
	})
	return err
}

func maxAllowedKeys(sess *sqlstore.DBSession, query Query, reqInp UpdateGlobalLocales, runQ bool) (error, bool) {
	var rows []KeyRow
	if runQ {
		err := sess.Table("bhd_localization").
			Select(fmt.Sprintf("jsonb_object_keys(\"%s\"::jsonb) as keys", LocaleENUS)).
			Where("org_id = ?", query.OrgID).
			Where("resource_uid = ?", query.ResourceUID).
			Find(&rows)
		if err != nil {
			return err, true
		}
	}

	// Convert rows to a set for quick lookup
	presentKeys := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		presentKeys[row.Keys] = struct{}{}
	}

	// Count new keys that are not already present
	newKeys := 0
	for key := range reqInp.Locales[LocaleENUS].Add {
		if _, exists := presentKeys[key]; !exists {
			newKeys++
		}
	}
	// Count the removed keys which was already present
	removedKeys := 0
	for _, val := range reqInp.Locales[LocaleENUS].Remove {
		if _, exists := presentKeys[val]; exists {
			removedKeys++
		}
	}

	if len(rows)+newKeys-removedKeys > MAX_ALLOWED_KEYS {
		return ErrExceedMaxAllowedKeys, true
	}
	return nil, false
}

func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `''`)
}
