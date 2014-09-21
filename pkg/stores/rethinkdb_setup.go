package stores

import (
	log "github.com/alecthomas/log4go"
	r "github.com/dancannon/gorethink"
)

func createRethinkDBTablesAndIndices(config *RethinkCfg, session *r.Session) {

	r.DbCreate(config.DatabaseName).Exec(session)

	// create tables
	r.Db(config.DatabaseName).TableCreate("dashboards").Exec(session)
	r.Db(config.DatabaseName).TableCreate("accounts").Exec(session)
	r.Db(config.DatabaseName).TableCreate("master").Exec(session)

	// create dashboard  accountId + slug index
	r.Db(config.DatabaseName).Table("dashboards").IndexCreateFunc("AccountIdSlug", func(row r.Term) interface{} {
		return []interface{}{row.Field("AccountId"), row.Field("Slug")}
	}).Exec(session)

	r.Db(config.DatabaseName).Table("dashboards").IndexCreate("AccountId").Exec(session)
	r.Db(config.DatabaseName).Table("accounts").IndexCreate("Login").Exec(session)

	// create account collaborator index
	r.Db(config.DatabaseName).Table("accounts").
		IndexCreateFunc("CollaboratorAccountId", func(row r.Term) interface{} {
		return row.Field("Collaborators").Map(func(row r.Term) interface{} {
			return row.Field("AccountId")
		})
	}, r.IndexCreateOpts{Multi: true}).Exec(session)

	// make sure master ids row exists
	_, err := r.Table("master").Insert(map[string]interface{}{"id": "ids", "NextAccountId": 0}).RunWrite(session)
	if err != nil {
		log.Error("Failed to insert master ids row", err)
	}

}
