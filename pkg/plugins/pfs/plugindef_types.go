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
	ActionSets  []ActionSet  `json:"actionsets,omitempty"`
}

type ActionSet struct {
	// actionsets
	Action  string   `json:"action"`
	Actions []string `json:"actions"`

	// TODO @eleijonmarck: register a managed permission
	// managed permissions for the actionset
	// DisplayName string   `json:"displayName"`
	// Kind        string   `json:"kind"`
	// Identifier  string   `json:"identifier"`
	// Grants      []string `json:"grants"`
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
