// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TemplateQuery is a query that accepts a query template and a
// map of key/value pairs to fill in template parameters.
//
// For more details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-template-query.html
type TemplateQuery struct {
	vars         map[string]interface{}
	template     string
	templateType string
}

// NewTemplateQuery creates a new TemplateQuery.
func NewTemplateQuery(name string) TemplateQuery {
	return TemplateQuery{
		template: name,
		vars:     make(map[string]interface{}),
	}
}

// Template specifies the name of the template.
func (q TemplateQuery) Template(name string) TemplateQuery {
	q.template = name
	return q
}

// TemplateType defines which kind of query we use. The values can be:
// inline, indexed, or file. If undefined, inline is used.
func (q TemplateQuery) TemplateType(typ string) TemplateQuery {
	q.templateType = typ
	return q
}

// Var sets a single parameter pair.
func (q TemplateQuery) Var(name string, value interface{}) TemplateQuery {
	q.vars[name] = value
	return q
}

// Vars sets parameters for the template query.
func (q TemplateQuery) Vars(vars map[string]interface{}) TemplateQuery {
	q.vars = vars
	return q
}

// Source returns the JSON serializable content for the search.
func (q TemplateQuery) Source() interface{} {
	// {
	//   "template" : {
	//     "query" : {"match_{{template}}": {}},
	//     "params" : {
	//       "template": "all"
	//     }
	//   }
	// }

	query := make(map[string]interface{})

	tmpl := make(map[string]interface{})
	query["template"] = tmpl

	// TODO(oe): Implementation differs from online documentation at http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-template-query.html
	var fieldname string
	switch q.templateType {
	case "file": // file
		fieldname = "file"
	case "indexed", "id": // indexed
		fieldname = "id"
	default: // inline
		fieldname = "query"
	}

	tmpl[fieldname] = q.template
	if len(q.vars) > 0 {
		tmpl["params"] = q.vars
	}

	return query
}
