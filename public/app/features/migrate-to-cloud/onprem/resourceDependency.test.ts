import { ResourceDependencyDto } from '../api';

import { buildDependencyMaps, handleSelection, handleDeselection, ResourceTypeId } from './resourceDependency';

describe('resourceDependency', () => {
  describe('buildDependencyMaps', () => {
    it('builds empty maps when given an empty array', () => {
      const dependencies: ResourceDependencyDto[] = [];
      const { dependencyMap, dependentMap } = buildDependencyMaps(dependencies);

      expect(dependencyMap.size).toBe(0);
      expect(dependentMap.size).toBe(0);
    });

    it('builds correct dependency maps for a simple dependency structure', () => {
      const dependencies: ResourceDependencyDto[] = [
        {
          resourceType: 'DASHBOARD',
          dependencies: ['DATASOURCE', 'FOLDER'],
        },
        {
          resourceType: 'LIBRARY_ELEMENT',
          dependencies: ['DATASOURCE'],
        },
        {
          resourceType: 'DATASOURCE',
          dependencies: [],
        },
        {
          resourceType: 'FOLDER',
          dependencies: [],
        },
      ];

      const { dependencyMap, dependentMap } = buildDependencyMaps(dependencies);

      expect(dependencyMap.size).toBe(4);
      expect(dependencyMap.get('DASHBOARD')).toEqual(['DATASOURCE', 'FOLDER']);
      expect(dependencyMap.get('LIBRARY_ELEMENT')).toEqual(['DATASOURCE']);
      expect(dependencyMap.get('DATASOURCE')).toEqual([]);
      expect(dependencyMap.get('FOLDER')).toEqual([]);

      expect(dependentMap.size).toBe(2);
      expect(dependentMap.get('DATASOURCE')?.sort()).toEqual(['DASHBOARD', 'LIBRARY_ELEMENT'].sort());
      expect(dependentMap.get('FOLDER')).toEqual(['DASHBOARD']);
    });

    it('handles undefined dependencies', () => {
      const dependencies: ResourceDependencyDto[] = [
        {
          resourceType: 'DASHBOARD',
          dependencies: undefined,
        },
      ];

      const { dependencyMap, dependentMap } = buildDependencyMaps(dependencies);

      expect(dependencyMap.size).toBe(1);
      expect(dependencyMap.get('DASHBOARD')).toEqual([]);
      expect(dependentMap.size).toBe(0);
    });

    // even though this is not going to be the case in the backend
    it('handles circular dependencies correctly', () => {
      const dependencies = [
        {
          resourceType: 'DASHBOARD',
          dependencies: ['FOLDER'],
        },
        {
          resourceType: 'FOLDER',
          dependencies: ['DATASOURCE'],
        },
        {
          resourceType: 'DATASOURCE',
          dependencies: ['DASHBOARD'],
        },
      ] as ResourceDependencyDto[];

      const { dependencyMap, dependentMap } = buildDependencyMaps(dependencies);

      expect(dependencyMap.size).toBe(3);
      expect(dependencyMap.get('DASHBOARD')).toEqual(['FOLDER']);
      expect(dependencyMap.get('FOLDER')).toEqual(['DATASOURCE']);
      expect(dependencyMap.get('DATASOURCE')).toEqual(['DASHBOARD']);

      expect(dependentMap.size).toBe(3);
      expect(dependentMap.get('DASHBOARD')).toEqual(['DATASOURCE']);
      expect(dependentMap.get('FOLDER')).toEqual(['DASHBOARD']);
      expect(dependentMap.get('DATASOURCE')).toEqual(['FOLDER']);
    });
  });

  describe('handleSelection', () => {
    it('selects a resource with no dependency', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['DATASOURCE', 'FOLDER']],
        ['DATASOURCE', []],
        ['FOLDER', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>([]);
      const result = handleSelection(dependencyMap, selectedTypes, 'DATASOURCE');

      expect(result.size).toBe(1);
      expect(result.has('DATASOURCE')).toBe(true);
    });

    it('selects a resource with dependencies and its dependencies', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['DATASOURCE', 'FOLDER']],
        ['DATASOURCE', []],
        ['FOLDER', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>([]);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(3);
      expect(result.has('DASHBOARD')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
    });

    it('selects a resource that is already selected and does not select anything else', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['DATASOURCE', 'FOLDER']],
        ['DATASOURCE', []],
        ['FOLDER', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DATASOURCE']);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(3);
      expect(result.has('DASHBOARD')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
    });

    it('handles circular dependencies', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['FOLDER']],
        ['FOLDER', ['DATASOURCE']],
        ['DATASOURCE', ['DASHBOARD']],
      ]);

      const selectedTypes = new Set<ResourceTypeId>([]);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(3);
      expect(result.has('DASHBOARD')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(true);
    });

    it('handles deep dependency chains', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['FOLDER']],
        ['FOLDER', ['DATASOURCE']],
        ['DATASOURCE', ['LIBRARY_ELEMENT']],
        ['LIBRARY_ELEMENT', ['PLUGIN']],
        ['PLUGIN', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>([]);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(5);
      expect(result.has('DASHBOARD')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('LIBRARY_ELEMENT')).toBe(true);
      expect(result.has('PLUGIN')).toBe(true);
    });

    it('preserves existing selections even when they are not part of the dependency chain', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['FOLDER']],
        ['FOLDER', []],
        ['DATASOURCE', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DATASOURCE']);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(3);
      expect(result.has('DASHBOARD')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(true);
    });

    it('handles empty dependency maps as if there are no dependencies', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>();
      const selectedTypes = new Set<ResourceTypeId>([]);
      const result = handleSelection(dependencyMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(1);
      expect(result.has('DASHBOARD')).toBe(true);
    });

    it('allows selecting unknown resource types', () => {
      const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>([['DASHBOARD', ['DATASOURCE']]]);

      const selectedTypes = new Set<ResourceTypeId>([]);
      // @ts-ignore
      const result = handleSelection(dependencyMap, selectedTypes, 'UNKNOWN_TYPE');

      expect(result.size).toBe(1);
      // @ts-ignore
      expect(result.has('UNKNOWN_TYPE')).toBe(true);
    });
  });

  describe('handleDeselection', () => {
    it('deselects a resource with no dependents', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', []],
        ['DATASOURCE', ['DASHBOARD']],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD', 'DATASOURCE']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(1);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('DASHBOARD')).toBe(false);
    });

    it('deselects a resource and all resources that depend on it', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', []],
        ['DATASOURCE', ['DASHBOARD']],
        ['FOLDER', ['DASHBOARD']],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD', 'DATASOURCE', 'FOLDER']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DATASOURCE');

      expect(result.size).toBe(1);
      expect(result.has('FOLDER')).toBe(true);
      expect(result.has('DASHBOARD')).toBe(false);
      expect(result.has('DATASOURCE')).toBe(false);
    });

    it('handles already deselected resources', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', []],
        ['DATASOURCE', ['DASHBOARD']],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DATASOURCE']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(1);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('DASHBOARD')).toBe(false);
    });

    it('handles circular dependencies without infinite loops', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', ['DATASOURCE']],
        ['FOLDER', ['DASHBOARD']],
        ['DATASOURCE', ['FOLDER']],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD', 'FOLDER', 'DATASOURCE']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(0);
    });

    it('handles deep dependency chains by unselecting recursively', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['PLUGIN', ['LIBRARY_ELEMENT']],
        ['LIBRARY_ELEMENT', ['DATASOURCE']],
        ['DATASOURCE', ['FOLDER']],
        ['FOLDER', ['DASHBOARD']],
        ['DASHBOARD', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['PLUGIN', 'LIBRARY_ELEMENT', 'DATASOURCE', 'FOLDER', 'DASHBOARD']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DATASOURCE');

      // After deselecting DATASOURCE, FOLDER and DASHBOARD should also be deselected
      // since they depend on DATASOURCE (directly or indirectly)
      // PLUGIN and LIBRARY_ELEMENT should remain
      expect(result.size).toBe(2);
      expect(result.has('PLUGIN')).toBe(true);
      expect(result.has('LIBRARY_ELEMENT')).toBe(true);
      expect(result.has('DATASOURCE')).toBe(false);
      expect(result.has('FOLDER')).toBe(false);
      expect(result.has('DASHBOARD')).toBe(false);
    });

    it('preserves unrelated selections', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([
        ['DASHBOARD', []],
        ['FOLDER', []],
        ['DATASOURCE', []],
      ]);

      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD', 'FOLDER', 'DATASOURCE']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(2);
      expect(result.has('DATASOURCE')).toBe(true);
      expect(result.has('FOLDER')).toBe(true);
      expect(result.has('DASHBOARD')).toBe(false);
    });

    it('handles empty dependency maps as if there are no dependencies', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>();
      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD']);
      const result = handleDeselection(dependentMap, selectedTypes, 'DASHBOARD');

      expect(result.size).toBe(0);
    });

    it('allows deselecting unknown resource types', () => {
      const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>([['DASHBOARD', []]]);

      const selectedTypes = new Set<ResourceTypeId>(['DASHBOARD']);
      // @ts-ignore - intentionally testing with an unknown type
      selectedTypes.add('UNKNOWN_TYPE');
      // @ts-ignore - intentionally testing with an unknown type
      const result = handleDeselection(dependentMap, selectedTypes, 'UNKNOWN_TYPE');

      expect(result.size).toBe(1);
      expect(result.has('DASHBOARD')).toBe(true);
    });
  });

  // Integration
  it('builds the dependency maps and does selection/deselection', () => {
    // 1. Create dependencies
    const dependencies: ResourceDependencyDto[] = [
      {
        resourceType: 'DASHBOARD',
        dependencies: ['DATASOURCE', 'FOLDER'],
      },
      {
        resourceType: 'LIBRARY_ELEMENT',
        dependencies: ['DATASOURCE'],
      },
      {
        resourceType: 'DATASOURCE',
        dependencies: [],
      },
      {
        resourceType: 'FOLDER',
        dependencies: [],
      },
    ];

    // 2. Build dependency maps
    const { dependencyMap, dependentMap } = buildDependencyMaps(dependencies);

    // 3. Start with empty selection
    let selection = new Set<ResourceTypeId>();

    // 4. Select DASHBOARD (should also select DATASOURCE and FOLDER)
    selection = handleSelection(dependencyMap, selection, 'DASHBOARD');
    expect(selection.size).toBe(3);
    expect(selection.has('DASHBOARD')).toBe(true);
    expect(selection.has('DATASOURCE')).toBe(true);
    expect(selection.has('FOLDER')).toBe(true);
    expect(selection.has('LIBRARY_ELEMENT')).toBe(false);

    // 5. Select LIBRARY_ELEMENT (should already have DATASOURCE selected)
    selection = handleSelection(dependencyMap, selection, 'LIBRARY_ELEMENT');
    expect(selection.size).toBe(4);
    expect(selection.has('LIBRARY_ELEMENT')).toBe(true);

    // 6. Deselect DATASOURCE (should also deselect DASHBOARD and LIBRARY_ELEMENT)
    selection = handleDeselection(dependentMap, selection, 'DATASOURCE');
    expect(selection.size).toBe(1);
    expect(selection.has('FOLDER')).toBe(true);
    expect(selection.has('DASHBOARD')).toBe(false);
    expect(selection.has('LIBRARY_ELEMENT')).toBe(false);
    expect(selection.has('DATASOURCE')).toBe(false);
  });
});
