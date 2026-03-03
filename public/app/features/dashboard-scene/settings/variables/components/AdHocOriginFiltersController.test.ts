import { AdHocFilterWithLabels } from '@grafana/scenes';

import { AdHocOriginFiltersController } from './AdHocOriginFiltersController';

function createController({
  filters = [] as AdHocFilterWithLabels[],
  wip = undefined as AdHocFilterWithLabels | undefined,
} = {}) {
  const setFilters = jest.fn();
  const setWip = jest.fn();
  const getKeys = jest.fn().mockResolvedValue([{ label: 'host', value: 'host' }]);
  const getValuesFor = jest.fn().mockResolvedValue([{ label: 'a', value: 'a' }]);
  const getOperators = jest.fn().mockReturnValue([{ label: '=', value: '=' }]);

  const controller = new AdHocOriginFiltersController(
    filters,
    setFilters,
    wip,
    setWip,
    getKeys,
    getValuesFor,
    getOperators
  );

  return { controller, setFilters, setWip, getKeys, getValuesFor, getOperators };
}

function makeFilter(overrides: Partial<AdHocFilterWithLabels> = {}): AdHocFilterWithLabels {
  return { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard', ...overrides };
}

describe('AdHocOriginFiltersController', () => {
  describe('useState', () => {
    it('should return empty state when no filters or wip', () => {
      const { controller } = createController();
      const state = controller.useState();

      expect(state.filters).toEqual([]);
      expect(state.wip).toBeUndefined();
    });

    it('should return current state with existing filters', () => {
      const filters = [makeFilter({ key: 'host', value: 'a' }), makeFilter({ key: 'instance', value: 'b' })];
      const { controller } = createController({ filters });

      const state = controller.useState();

      expect(state.filters).toHaveLength(2);
      expect(state.filters[0]).toMatchObject({ key: 'host', operator: '=', value: 'a' });
      expect(state.filters[1]).toMatchObject({ key: 'instance', operator: '=', value: 'b' });
    });

    it('should include wip filter in state', () => {
      const wip: AdHocFilterWithLabels = { key: 'host', operator: '=', value: '', origin: 'dashboard' };
      const { controller } = createController({ wip });

      const state = controller.useState();

      expect(state.wip).toEqual(wip);
    });

    it('should return static defaults', () => {
      const { controller } = createController();
      const state = controller.useState();

      expect(state.readOnly).toBe(false);
      expect(state.allowCustomValue).toBe(true);
      expect(state.supportsMultiValueOperators).toBe(true);
      expect(state.inputPlaceholder).toBe('Add a default filter...');
    });
  });

  describe('getKeys / getValuesFor / getOperators', () => {
    it('should delegate getKeys', async () => {
      const { controller, getKeys } = createController();
      const result = await controller.getKeys('host');
      expect(getKeys).toHaveBeenCalledWith('host');
      expect(result).toEqual([{ label: 'host', value: 'host' }]);
    });

    it('should delegate getValuesFor', async () => {
      const filter = makeFilter();
      const { controller, getValuesFor } = createController();
      const result = await controller.getValuesFor(filter);
      expect(getValuesFor).toHaveBeenCalledWith(filter);
      expect(result).toEqual([{ label: 'a', value: 'a' }]);
    });

    it('should delegate getOperators', () => {
      const { controller, getOperators } = createController();
      const result = controller.getOperators();
      expect(getOperators).toHaveBeenCalled();
      expect(result).toEqual([{ label: '=', value: '=' }]);
    });
  });

  describe('updateFilter', () => {
    describe('WIP filter', () => {
      it('should commit WIP to filters when value is set and key exists', () => {
        const wip: AdHocFilterWithLabels = { key: 'host', operator: '=', value: '', origin: 'dashboard' };
        const { controller, setFilters, setWip } = createController({ wip });

        controller.updateFilter(wip, { value: 'localhost' });

        expect(setFilters).toHaveBeenCalledWith([
          { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard' },
        ]);
        expect(setWip).toHaveBeenCalledWith(undefined);
      });

      it('should not commit WIP when key is empty', () => {
        const wip: AdHocFilterWithLabels = { key: '', operator: '=', value: '', origin: 'dashboard' };
        const { controller, setFilters, setWip } = createController({ wip });

        controller.updateFilter(wip, { value: 'localhost' });

        expect(setFilters).not.toHaveBeenCalled();
        expect(setWip).toHaveBeenCalledWith({ key: '', operator: '=', value: 'localhost', origin: 'dashboard' });
      });

      it('should not commit WIP when value is empty', () => {
        const wip: AdHocFilterWithLabels = { key: 'host', operator: '=', value: '', origin: 'dashboard' };
        const { controller, setFilters, setWip } = createController({ wip });

        controller.updateFilter(wip, { key: 'instance' });

        expect(setFilters).not.toHaveBeenCalled();
        expect(setWip).toHaveBeenCalledWith({ key: 'instance', operator: '=', value: '', origin: 'dashboard' });
      });

      it('should update WIP in place for partial changes', () => {
        const wip: AdHocFilterWithLabels = { key: '', operator: '=', value: '', origin: 'dashboard' };
        const { controller, setWip } = createController({ wip });

        controller.updateFilter(wip, { key: 'host' });

        expect(setWip).toHaveBeenCalledWith({ key: 'host', operator: '=', value: '', origin: 'dashboard' });
      });

      it('should handle multiple properties updated at once', () => {
        const wip: AdHocFilterWithLabels = { key: '', operator: '=', value: '', origin: 'dashboard' };
        const { controller, setWip } = createController({ wip });

        controller.updateFilter(wip, { key: 'host', operator: '!=' });

        expect(setWip).toHaveBeenCalledWith({ key: 'host', operator: '!=', value: '', origin: 'dashboard' });
      });
    });

    describe('committed filter', () => {
      it('should update a committed filter by value match', () => {
        const existing = makeFilter({ key: 'host', value: 'a' });
        const { controller, setFilters } = createController({ filters: [existing] });

        controller.updateFilter({ key: 'host', operator: '=', value: 'a' }, { value: 'b' });

        expect(setFilters).toHaveBeenCalledWith([{ key: 'host', operator: '=', value: 'b', origin: 'dashboard' }]);
      });

      it('should preserve origin: dashboard on update', () => {
        const existing = makeFilter();
        const { controller, setFilters } = createController({ filters: [existing] });

        controller.updateFilter({ key: 'host', operator: '=', value: 'localhost' }, { operator: '!=' });

        expect(setFilters).toHaveBeenCalledWith([expect.objectContaining({ origin: 'dashboard', operator: '!=' })]);
      });

      it('should not update if filter is not found', () => {
        const { controller, setFilters } = createController({ filters: [makeFilter()] });

        controller.updateFilter({ key: 'nonexistent', operator: '=', value: 'x' }, { value: 'y' });

        expect(setFilters).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateToMatchAll', () => {
    it('should delegate to removeFilter', () => {
      const filter = makeFilter();
      const { controller, setFilters } = createController({ filters: [filter] });

      controller.updateToMatchAll({ key: 'host', operator: '=', value: 'localhost' });

      expect(setFilters).toHaveBeenCalledWith([]);
    });
  });

  describe('removeFilter', () => {
    it('should remove a filter by value match', () => {
      const filters = [makeFilter({ key: 'host', value: 'a' }), makeFilter({ key: 'instance', value: 'b' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeFilter({ key: 'host', operator: '=', value: 'a' });

      expect(setFilters).toHaveBeenCalledWith([filters[1]]);
    });

    it('should handle removing from empty list', () => {
      const { controller, setFilters } = createController({ filters: [] });

      controller.removeFilter({ key: 'host', operator: '=', value: 'localhost' });

      expect(setFilters).not.toHaveBeenCalled();
    });

    it('should not modify filters if not found', () => {
      const { controller, setFilters } = createController({ filters: [makeFilter()] });

      controller.removeFilter({ key: 'nonexistent', operator: '=', value: 'x' });

      expect(setFilters).not.toHaveBeenCalled();
    });

    it('should only remove the first match when duplicates exist', () => {
      const filters = [makeFilter({ key: 'host', value: 'a' }), makeFilter({ key: 'host', value: 'a' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeFilter({ key: 'host', operator: '=', value: 'a' });

      expect(setFilters).toHaveBeenCalledWith([filters[1]]);
    });
  });

  describe('removeLastFilter', () => {
    it('should remove the last filter', () => {
      const filters = [makeFilter({ key: 'a', value: '1' }), makeFilter({ key: 'b', value: '2' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeLastFilter();

      expect(setFilters).toHaveBeenCalledWith([filters[0]]);
    });

    it('should remove the only filter', () => {
      const filters = [makeFilter({ key: 'a', value: '1' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeLastFilter();

      expect(setFilters).toHaveBeenCalledWith([]);
    });

    it('should do nothing when filters are empty', () => {
      const { controller, setFilters } = createController({ filters: [] });

      controller.removeLastFilter();

      expect(setFilters).not.toHaveBeenCalled();
    });
  });

  describe('handleComboboxBackspace', () => {
    it('should set forceEdit on the previous filter', () => {
      const filters = [
        makeFilter({ key: 'a', value: '1' }),
        makeFilter({ key: 'b', value: '2' }),
        makeFilter({ key: 'c', value: '3' }),
      ];
      const { controller, setFilters } = createController({ filters });

      controller.handleComboboxBackspace({ key: 'b', operator: '=', value: '2' });

      expect(setFilters).toHaveBeenCalledWith([
        { ...filters[0], forceEdit: true },
        { ...filters[1], forceEdit: false },
        { ...filters[2], forceEdit: false },
      ]);
    });

    it('should do nothing when filter is at index 0', () => {
      const filters = [makeFilter({ key: 'a', value: '1' })];
      const { controller, setFilters } = createController({ filters });

      controller.handleComboboxBackspace({ key: 'a', operator: '=', value: '1' });

      expect(setFilters).not.toHaveBeenCalled();
    });

    it('should do nothing when filter is not found', () => {
      const filters = [makeFilter()];
      const { controller, setFilters } = createController({ filters });

      controller.handleComboboxBackspace({ key: 'nonexistent', operator: '=', value: 'x' });

      expect(setFilters).not.toHaveBeenCalled();
    });
  });

  describe('addWip', () => {
    it('should create a WIP filter with origin: dashboard', () => {
      const { controller, setWip } = createController();

      controller.addWip();

      expect(setWip).toHaveBeenCalledWith({
        key: '',
        operator: '=',
        value: '',
        origin: 'dashboard',
      });
    });
  });

  describe('restoreOriginalFilter', () => {
    it('should be a no-op', () => {
      const { controller, setFilters, setWip } = createController({ filters: [makeFilter()] });

      controller.restoreOriginalFilter(makeFilter());

      expect(setFilters).not.toHaveBeenCalled();
      expect(setWip).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all filters and wip', () => {
      const wip: AdHocFilterWithLabels = { key: 'x', operator: '=', value: '', origin: 'dashboard' };
      const { controller, setFilters, setWip } = createController({
        filters: [makeFilter(), makeFilter({ key: 'b' })],
        wip,
      });

      controller.clearAll();

      expect(setFilters).toHaveBeenCalledWith([]);
      expect(setWip).toHaveBeenCalledWith(undefined);
    });

    it('should clear filters when there is no wip', () => {
      const { controller, setFilters, setWip } = createController({
        filters: [makeFilter()],
      });

      controller.clearAll();

      expect(setFilters).toHaveBeenCalledWith([]);
      expect(setWip).toHaveBeenCalledWith(undefined);
    });
  });
});
