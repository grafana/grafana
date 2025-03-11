package pfs

type PluginDef struct {
	Id      string
	Name    string
	Backend *bool
	Type    string
	Info    Info
}

type Info struct {
	Version *string
}

func (pd PluginDef) Validate() error {
	if pd.Id == "" || pd.Name == "" || pd.Type == "" {
		return ErrInvalidRootFile
	}

	return nil
}
