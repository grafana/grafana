package pluginsettings

func ToSecureJsonFields(decrypted map[string]string) map[string]bool {
	fields := map[string]bool{}

	for k, v := range decrypted {
		if len(v) > 0 {
			fields[k] = true
		}
	}

	return fields
}
