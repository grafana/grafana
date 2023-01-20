package main

type Resource struct {
	Name            string
	Attribute       string
	Parent          string
	ParentAttribute string
	Verbs           []Verb
	SubResources    []SubResource
}

type SubResource struct {
	Name  string
	Verbs []Verb
}

type Verb struct {
	Name            string
	Desc            string
	Unscoped        bool
	ParentOnlyScope bool
}

var registry = []Resource{
	{
		Name:      "datasources",
		Attribute: "uid",
		Verbs: []Verb{
			{Name: "read", Desc: "Read one or more data sources."},
			{Name: "query", Desc: "Query one or more data sources."},
			{Name: "create", Desc: "Create data sources"},
			{Name: "write", Desc: "Update one or more data sources."},
			{Name: "delete", Desc: "Delete one or more data sources"},
			{Name: "explore", Desc: "Enable access to the **Explore** tab.", Unscoped: true},
		},
		SubResources: []SubResource{
			{
				Name: "permissions",
				Verbs: []Verb{
					{Name: "read", Desc: "Read permissions for one or more data sources."},
					{Name: "write", Desc: "Update permissions for one or more data sources."},
				},
			},
			{
				Name:  "id",
				Verbs: []Verb{{Name: "read", Desc: "Read data source IDs."}},
			},
			{
				Name: "caching",
				Verbs: []Verb{
					{
						Name: "read",
						Desc: "Read data source query caching settings.",
					},
					{
						Name: "write",
						Desc: "Update data source query caching settings.",
					},
				},
			},
			{
				Name:  "insights",
				Verbs: []Verb{{Name: "read", Desc: "Read data sources insights data.", Unscoped: true}},
			},
		},
	},
	{
		Name:            "dashboards",
		Attribute:       "uid",
		Parent:          "folders",
		ParentAttribute: "uid",
		Verbs: []Verb{
			{Name: "read", Desc: "Read one or more dashboards."},
			{Name: "write", Desc: "Update one or more dashboards"},
			{Name: "create", Desc: "Create dashboards in one or more folders.", ParentOnlyScope: true},
			{Name: "delete", Desc: "Delete one or more dashboards."}},
		SubResources: []SubResource{
			{
				Name: "permissions",
				Verbs: []Verb{
					{Name: "read", Desc: "Read permissions for one or more dashboards."},
					{Name: "write", Desc: "Update permissions for one or more dashboards."},
				},
			},
			{
				Name:  "public",
				Verbs: []Verb{{Name: "write", Desc: ""}},
			},
			{
				Name:  "insights",
				Verbs: []Verb{{Name: "read", Desc: "Read dashboard insights data and see presence indicators.", Unscoped: true}},
			},
		},
	},
	{
		Name:      "folders",
		Attribute: "uid",
		Verbs: []Verb{
			{Name: "read", Desc: "Read one or more folders."},
			{Name: "write", Desc: "Update one or more folders."},
			{Name: "delete", Desc: "Delete one or more folders."},
			{Name: "create", Desc: "Create folders."},
		},
		SubResources: []SubResource{
			{
				Name: "permissions",
				Verbs: []Verb{
					{Name: "read", Desc: "Read permissions for one or more folders."},
					{Name: "write", Desc: "Update permissions for one or more folders."},
				},
			},
		},
	},
}
