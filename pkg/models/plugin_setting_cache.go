package models

var pluginSettingDecryptionCache = secureJSONDecryptionCache{
	cache: make(map[int64]cachedDecryptedJSON),
}

// DecryptedValues returns cached decrypted values from secureJsonData.
func (ps *PluginSetting) DecryptedValues() map[string]string {
	pluginSettingDecryptionCache.Lock()
	defer pluginSettingDecryptionCache.Unlock()

	if item, present := pluginSettingDecryptionCache.cache[ps.Id]; present && ps.Updated.Equal(item.updated) {
		return item.json
	}

	json := ps.SecureJsonData.Decrypt()
	pluginSettingDecryptionCache.cache[ps.Id] = cachedDecryptedJSON{
		updated: ps.Updated,
		json:    json,
	}

	return json
}

// DecryptedValue returns cached decrypted value from cached secureJsonData.
func (ps *PluginSetting) DecryptedValue(key string) (string, bool) {
	value, exists := ps.DecryptedValues()[key]
	return value, exists
}

// ClearPluginSettingDecryptionCache clears the datasource decryption cache.
func ClearPluginSettingDecryptionCache() {
	pluginSettingDecryptionCache.Lock()
	defer pluginSettingDecryptionCache.Unlock()

	pluginSettingDecryptionCache.cache = make(map[int64]cachedDecryptedJSON)
}
