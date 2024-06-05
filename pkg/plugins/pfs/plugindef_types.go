package pfs

type Type string

// Defines values for Type.
const (
	TypeApp            Type = "app"
	TypeDatasource     Type = "datasource"
	TypePanel          Type = "panel"
	TypeRenderer       Type = "renderer"
	TypeSecretsmanager Type = "secretsmanager"
)

type PluginDef struct {
	Id      string
	Name    string
	Backend *bool
	Type    Type
	Info    Info
	IAM     IAM
}

type Info struct {
	Version *string
}

type IAM struct {
	Permissions []Permission `json:"permissions,omitempty"`
	ActionSets  []ActionSet  `json:"actionSets,omitempty"`
}

//	{
//		"actionSets": [
//		  {
//			// actionset
//	   "action": "grafana-k6-app.edit",
//			"actions": [
//			  { "action": "grafana-k6-app.tests:read" },
//			  { "action": "grafana-k6-app.tests:write" }
//			],
//		   // managed permissions
//			"displayName": "Edit", // PluginID + human friendly UI picker displayName
//			"kind": "folders",
//			"identifier": "uid",
//			"grants": ["Edit", "Admin"] // edit gives you a set of permissions, when you grant edit/admin to a folder , we  now grant k6-app.edit as well
//		  }
//		]
//	}
type ActionSet struct {
	// actionsets
	Action  string   `json:"action"`
	Actions []Action `json:"actions"`

	// TODO @eleijonmarck: register a managed permission
	// managed permissions for the actionset
	// DisplayName string   `json:"displayName"`
	// Kind        string   `json:"kind"`
	// Identifier  string   `json:"identifier"`
	// Grants      []string `json:"grants"`
}

type Action struct {
	Action string `json:"action"`
}

type Permission struct {
	Action string  `json:"action"`
	Scope  *string `json:"scope,omitempty"`
}

func (pd PluginDef) Validate() error {
	if pd.Id == "" || pd.Name == "" || pd.Type == "" {
		return ErrInvalidRootFile
	}

	return nil
}
