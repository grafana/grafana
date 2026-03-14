import { DataTransformerConfig } from '@grafana/data';

import { getTransformationUid, transferTransformationUid } from './transformationUid';

describe('transformationUid', () => {
  describe('getTransformationUid', () => {
    it('should return a stable UUID for the same config object', () => {
      const config: DataTransformerConfig = { id: 'organize', options: {} };

      const uid1 = getTransformationUid(config);
      const uid2 = getTransformationUid(config);

      expect(uid1).toBe(uid2);
    });

    it('should return different UUIDs for different config objects', () => {
      const configA: DataTransformerConfig = { id: 'organize', options: {} };
      const configB: DataTransformerConfig = { id: 'organize', options: {} };

      expect(getTransformationUid(configA)).not.toBe(getTransformationUid(configB));
    });
  });

  describe('transferTransformationUid', () => {
    it('should transfer the UUID from one config to another', () => {
      const oldConfig: DataTransformerConfig = { id: 'reduce', options: {} };
      const originalUid = getTransformationUid(oldConfig);

      const newConfig: DataTransformerConfig = { ...oldConfig, disabled: true };
      transferTransformationUid(oldConfig, newConfig);

      expect(getTransformationUid(newConfig)).toBe(originalUid);
    });

    it('should be a no-op when the source has no stored UUID', () => {
      const unknown: DataTransformerConfig = { id: 'filter', options: {} };
      const target: DataTransformerConfig = { id: 'filter', options: {} };

      // Transfer from an object that was never passed to getTransformationUid
      transferTransformationUid(unknown, target);

      // target should get its own fresh UUID
      const uid = getTransformationUid(target);
      expect(uid).toBeDefined();
      expect(uid).not.toBe(getTransformationUid(unknown));
    });
  });
});
