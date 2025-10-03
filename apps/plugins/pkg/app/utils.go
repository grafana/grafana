package app

func ToMetadataName(id, version string) (string, error) {
	return id, nil
}

func FromMetadataName(name string) (id, version string, ok bool) {
	return name, "", true
}
