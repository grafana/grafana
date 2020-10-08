package secrets

// EncryptedJSON is used to store encrypted data (for example in data_source table). Only values are separately
// encrypted.
type EncryptedJSON struct {
	s   *Secrets
	Map map[string][]byte
}

// DecryptedValue returns single decrypted value from EncryptedJSON. Similar to normal map access second return value
// is true if the key exists and false if not.
func (j EncryptedJSON) DecryptedValue(key string) (string, bool) {
	if value, ok := j.Map[key]; ok {
		decryptedData, err := j.s.Decrypt(value, "")
		if err != nil {
			logger.Error("could not decrypt value", "key", key, "err", err.Error())
			return "", false
		}
		return string(decryptedData), true
	}
	return "", false
}

// Decrypt returns map of the same type but where the all the values are decrypted. Opposite of what
// EncryptJSONMap is doing.
func (j EncryptedJSON) DecryptJSONMap() (map[string]string, error) {
	decrypted := make(map[string]string)
	for key, data := range j.Map {
		decryptedData, err := j.s.Decrypt(data, "")
		if err != nil {
			logger.Error("could not decrypt map", "err", err.Error())
			return nil, err
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted, nil
}

// EncryptJSONMap returns map where all values are encrypted.
func (s *Secrets) EncryptJSONMap(m map[string]string) (EncryptedJSON, error) {
	encrypted := EncryptedJSON{
		s:   s,
		Map: make(map[string][]byte),
	}
	for key, data := range m {
		encryptedData, err := s.Encrypt([]byte(data), "")
		if err != nil {
			return EncryptedJSON{}, err
		}

		encrypted.Map[key] = encryptedData
	}
	return encrypted, nil
}
