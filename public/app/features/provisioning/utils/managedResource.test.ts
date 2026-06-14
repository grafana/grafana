import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';

import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
  isManagedByRepository,
  isManagedResourceReadOnly,
  type ManagedResource,
} from './managedResource';

const resource = (annotations?: Record<string, string>): ManagedResource => ({
  metadata: { annotations },
});

describe('managedResource helpers', () => {
  describe('getManagerKind', () => {
    it.each([ManagerKind.Repo, ManagerKind.Terraform, ManagerKind.Kubectl, ManagerKind.Plugin, ManagerKind.ClassicFP])(
      'returns the manager kind when set (%s)',
      (kind) => {
        expect(getManagerKind(resource({ [AnnoKeyManagerKind]: kind }))).toBe(kind);
      }
    );

    it('returns undefined for an unknown manager kind', () => {
      expect(getManagerKind(resource({ [AnnoKeyManagerKind]: 'some-future-manager' }))).toBeUndefined();
    });

    it('returns undefined when not managed', () => {
      expect(getManagerKind(resource())).toBeUndefined();
      expect(getManagerKind({})).toBeUndefined();
    });
  });

  describe('getManagerIdentity', () => {
    it('returns the manager identity when set', () => {
      expect(getManagerIdentity(resource({ [AnnoKeyManagerIdentity]: 'my-repo' }))).toBe('my-repo');
    });
  });

  describe('getSourcePath', () => {
    it('returns the source path when set', () => {
      expect(getSourcePath(resource({ [AnnoKeySourcePath]: 'playlists/foo.json' }))).toBe('playlists/foo.json');
    });

    it('returns undefined when not set', () => {
      expect(getSourcePath(resource())).toBeUndefined();
    });
  });

  describe('isManaged', () => {
    it.each([ManagerKind.Repo, ManagerKind.Terraform, ManagerKind.Kubectl, ManagerKind.Plugin])(
      'returns true for any manager kind (%s)',
      (kind) => {
        expect(isManaged(resource({ [AnnoKeyManagerKind]: kind }))).toBe(true);
      }
    );

    it('returns true for managers not represented by ManagerKind (unknown future kind)', () => {
      expect(isManaged(resource({ [AnnoKeyManagerKind]: 'some-future-manager' }))).toBe(true);
    });

    it('returns false when not managed', () => {
      expect(isManaged(resource())).toBe(false);
    });
  });

  describe('isManagedByRepository', () => {
    it('returns true only for repository-managed resources', () => {
      expect(isManagedByRepository(resource({ [AnnoKeyManagerKind]: ManagerKind.Repo }))).toBe(true);
    });

    it.each([ManagerKind.Terraform, ManagerKind.Kubectl, ManagerKind.Plugin])(
      'returns false for non-repository managers (%s)',
      (kind) => {
        expect(isManagedByRepository(resource({ [AnnoKeyManagerKind]: kind }))).toBe(false);
      }
    );

    it('returns false when not managed', () => {
      expect(isManagedByRepository(resource())).toBe(false);
    });
  });

  describe('isManagedResourceReadOnly', () => {
    it('returns false for repository-managed resources (they have their own edit workflow)', () => {
      expect(isManagedResourceReadOnly(resource({ [AnnoKeyManagerKind]: ManagerKind.Repo }))).toBe(false);
    });

    it('returns true for other managers that do not allow edits', () => {
      expect(isManagedResourceReadOnly(resource({ [AnnoKeyManagerKind]: ManagerKind.Terraform }))).toBe(true);
    });

    it('returns false when the manager allows edits', () => {
      expect(
        isManagedResourceReadOnly(
          resource({ [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerAllowsEdits]: 'true' })
        )
      ).toBe(false);
    });

    it('returns false when not managed', () => {
      expect(isManagedResourceReadOnly(resource())).toBe(false);
    });
  });
});
