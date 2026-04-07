import { type AdHocFilterWithLabels } from '@grafana/scenes';

import { AdHocOriginFiltersController } from './AdHocOriginFiltersController';

function createController({
  filters = [] as AdHocFilterWithLabels[],
  wip = undefined as AdHocFilterWithLabels | undefined,
  allowCustomValue = true,
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
    allowCustomValue,
    getKeys,
    getValuesFor,
    getOperators
  );

  return { controller, setFilters, setWip, getKeys, getValuesFor, getOperators };
}

function makeFilter(overrides: Partial<AdHocFilterWithLabels> = {}): AdHocFilterWithLabels {
  return { key: 'host', operator: '=', value: 'localhost', origin: 'dashboard', ...overrides };
}

function makeWip(overrides: Partial<AdHocFilterWithLabels> = {}): AdHocFilterWithLabels {
  return makeFilter({ value: '', ...overrides });
}

describe('AdHocOriginFiltersController', () => {
  it('should return current state', () => {
    const filters = [makeFilter({ key: 'host', value: 'a' }), makeFilter({ key: 'instance', value: 'b' })];
    const wip = makeWip();
    const { controller } = createController({ filters, wip, allowCustomValue: false });

    const state = controller.useState();

    expect(state.filters).toHaveLength(2);
    expect(state.filters[0]).toMatchObject({ key: 'host', operator: '=', value: 'a' });
    expect(state.filters[1]).toMatchObject({ key: 'instance', operator: '=', value: 'b' });
    expect(state.wip).toEqual(wip);
    expect(state.readOnly).toBe(false);
    expect(state.allowCustomValue).toBe(false);
    expect(state.supportsMultiValueOperators).toBe(true);
    expect(state.inputPlaceholder).toBe('Add a default filter...');
    expect(state.enableGroupBy).toBe(false);
  });

  it('should delegate getKeys, getValuesFor, and getOperators', async () => {
    const filter = makeFilter();
    const { controller, getKeys, getValuesFor, getOperators } = createController();

    const keys = await controller.getKeys('host');
    expect(getKeys).toHaveBeenCalledWith('host');
    expect(keys).toEqual([{ label: 'host', value: 'host' }]);

    const values = await controller.getValuesFor(filter);
    expect(getValuesFor).toHaveBeenCalledWith(filter);
    expect(values).toEqual([{ label: 'a', value: 'a' }]);

    const operators = controller.getOperators();
    expect(getOperators).toHaveBeenCalled();
    expect(operators).toEqual([{ label: '=', value: '=' }]);
  });

  describe('updateFilter – WIP', () => {
    it('should commit WIP when key and value are both set', () => {
      const wip = makeWip();
      const { controller, setFilters, setWip } = createController({ wip });

      controller.updateFilter(wip, { value: 'localhost' });

      expect(setFilters).toHaveBeenCalledWith([makeFilter()]);
      expect(setWip).toHaveBeenCalledWith(undefined);
    });

    it('should not commit WIP when key is empty', () => {
      const wip = makeWip({ key: '' });
      const { controller, setFilters, setWip } = createController({ wip });

      controller.updateFilter(wip, { value: 'localhost' });

      expect(setFilters).not.toHaveBeenCalled();
      expect(setWip).toHaveBeenCalledWith(makeWip({ key: '', value: 'localhost' }));
    });

    it('should not commit WIP when value is empty', () => {
      const wip = makeWip();
      const { controller, setFilters, setWip } = createController({ wip });

      controller.updateFilter(wip, { key: 'instance' });

      expect(setFilters).not.toHaveBeenCalled();
      expect(setWip).toHaveBeenCalledWith(makeWip({ key: 'instance' }));
    });

    it('should update WIP in place for partial changes', () => {
      const wip = makeWip({ key: '' });
      const { controller, setWip } = createController({ wip });

      controller.updateFilter(wip, { key: 'host' });
      expect(setWip).toHaveBeenCalledWith(makeWip());

      setWip.mockClear();
      controller.updateFilter(wip, { key: 'host', operator: '!=' });
      expect(setWip).toHaveBeenCalledWith(makeWip({ operator: '!=' }));
    });
  });

  describe('updateFilter – committed', () => {
    it('should update a committed filter by value match', () => {
      const existing = makeFilter({ value: 'a' });
      const { controller, setFilters } = createController({ filters: [existing] });

      controller.updateFilter(existing, { value: 'b' });

      expect(setFilters).toHaveBeenCalledWith([makeFilter({ value: 'b' })]);
    });

    it('should preserve origin on update', () => {
      const existing = makeFilter();
      const { controller, setFilters } = createController({ filters: [existing] });

      controller.updateFilter(existing, { operator: '!=' });

      expect(setFilters).toHaveBeenCalledWith([expect.objectContaining({ origin: 'dashboard', operator: '!=' })]);
    });

    it('should not update if filter is not found', () => {
      const { controller, setFilters } = createController({ filters: [makeFilter()] });

      controller.updateFilter(makeFilter({ key: 'nonexistent', value: 'x' }), { value: 'y' });

      expect(setFilters).not.toHaveBeenCalled();
    });
  });

  it('updateToMatchAll should remove the matching filter', () => {
    const existing = makeFilter();
    const { controller, setFilters } = createController({ filters: [existing] });

    controller.updateToMatchAll(existing);

    expect(setFilters).toHaveBeenCalledWith([]);
  });

  describe('removeFilter', () => {
    it('should remove a filter by value match', () => {
      const filters = [makeFilter({ value: 'a' }), makeFilter({ key: 'instance', value: 'b' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeFilter(filters[0]);

      expect(setFilters).toHaveBeenCalledWith([filters[1]]);
    });

    it('should only remove the first match when duplicates exist', () => {
      const filters = [makeFilter({ value: 'a' }), makeFilter({ value: 'a' })];
      const { controller, setFilters } = createController({ filters });

      controller.removeFilter(filters[0]);

      expect(setFilters).toHaveBeenCalledWith([filters[1]]);
    });

    it('should not modify filters if not found or empty', () => {
      const { controller: c1, setFilters: sf1 } = createController({ filters: [] });
      c1.removeFilter(makeFilter());
      expect(sf1).not.toHaveBeenCalled();

      const { controller: c2, setFilters: sf2 } = createController({ filters: [makeFilter()] });
      c2.removeFilter(makeFilter({ key: 'nonexistent', value: 'x' }));
      expect(sf2).not.toHaveBeenCalled();
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
      const { controller, setFilters } = createController({ filters: [makeFilter()] });

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

      controller.handleComboboxBackspace(filters[1]);

      expect(setFilters).toHaveBeenCalledWith([
        { ...filters[0], forceEdit: true },
        { ...filters[1], forceEdit: false },
        { ...filters[2], forceEdit: false },
      ]);
    });

    it('should do nothing when filter is at index 0 or not found', () => {
      const filters = [makeFilter({ key: 'a', value: '1' })];
      const { controller: c1, setFilters: sf1 } = createController({ filters });
      c1.handleComboboxBackspace(filters[0]);
      expect(sf1).not.toHaveBeenCalled();

      const { controller: c2, setFilters: sf2 } = createController({ filters: [makeFilter()] });
      c2.handleComboboxBackspace(makeFilter({ key: 'nonexistent', value: 'x' }));
      expect(sf2).not.toHaveBeenCalled();
    });
  });

  it('addWip should create a WIP filter with origin: dashboard', () => {
    const { controller, setWip } = createController();

    controller.addWip();

    expect(setWip).toHaveBeenCalledWith(makeWip({ key: '' }));
  });

  it('clearAll should clear all filters and wip', () => {
    const { controller, setFilters, setWip } = createController({
      filters: [makeFilter(), makeFilter({ key: 'b' })],
      wip: makeWip(),
    });

    controller.clearAll();

    expect(setFilters).toHaveBeenCalledWith([]);
    expect(setWip).toHaveBeenCalledWith(undefined);
  });
});

describe('origin filtering (editor integration)', () => {
  const scopeFilter = makeFilter({ key: 'product', value: 'shoes', origin: 'scope' });
  const dashFilter = makeFilter({ key: 'host', value: 'a' });

  function createControllerWithOriginSplit(originFilters: AdHocFilterWithLabels[]) {
    const dashboardFilters = originFilters.filter((f) => f.origin === 'dashboard');
    const nonDashboardFilters = originFilters.filter((f) => f.origin !== 'dashboard');
    const setState = jest.fn();
    const setWip = jest.fn();

    const controller = new AdHocOriginFiltersController(
      dashboardFilters,
      (filters) => setState({ originFilters: [...nonDashboardFilters, ...filters] }),
      undefined,
      setWip,
      true,
      jest.fn().mockResolvedValue([]),
      jest.fn().mockResolvedValue([]),
      jest.fn().mockReturnValue([])
    );

    return { controller, setState, setWip };
  }

  it('should only expose dashboard-origin filters', () => {
    const { controller } = createControllerWithOriginSplit([scopeFilter, dashFilter]);
    const state = controller.useState();
    expect(state.filters).toEqual([dashFilter]);
  });

  it('should preserve scope filters when adding a dashboard filter', () => {
    const wip = makeWip();
    const setState = jest.fn();
    const nonDashboardFilters = [scopeFilter];

    const controller = new AdHocOriginFiltersController(
      [],
      (filters) => setState({ originFilters: [...nonDashboardFilters, ...filters] }),
      wip,
      jest.fn(),
      true,
      jest.fn().mockResolvedValue([]),
      jest.fn().mockResolvedValue([]),
      jest.fn().mockReturnValue([])
    );

    controller.updateFilter(wip, { value: 'localhost' });

    expect(setState).toHaveBeenCalledWith({
      originFilters: [scopeFilter, makeFilter()],
    });
  });
});
