package secrets

type settingsSecretKey struct {
	key func() []byte
}

func (s *settingsSecretKey) Encrypt(blob []byte) ([]byte, error) {
	return encrypt(blob, s.key())
}

func (s *settingsSecretKey) Decrypt(blob []byte) ([]byte, error) {
	return decrypt(blob, s.key())
}
