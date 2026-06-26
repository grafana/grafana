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
