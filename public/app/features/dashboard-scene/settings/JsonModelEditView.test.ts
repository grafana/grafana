import { JsonModelEditView } from './JsonModelEditView';

describe('JsonModelEditView.getEditedSaveModel', () => {
  it('unwraps the v2 resource envelope back to the bare spec', () => {
    const view = new JsonModelEditView({});
    // A v2 spec is detected by the presence of `elements`.
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ elements: {}, title: 'current' } as unknown as ReturnType<typeof view.getSaveModel>);

    const resource = {
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      spec: { elements: {}, title: 'edited' },
    };
    view.setState({ jsonText: JSON.stringify(resource) });

    expect(view.getEditedSaveModel()).toEqual(resource.spec);
  });

  it('returns the parsed model as-is for v1 dashboards', () => {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ title: 'v1 dashboard' } as unknown as ReturnType<typeof view.getSaveModel>);

    const model = { title: 'v1 dashboard', panels: [] };
    view.setState({ jsonText: JSON.stringify(model) });

    expect(view.getEditedSaveModel()).toEqual(model);
  });
});

describe('JsonModelEditView.validateEditedResource', () => {
  function setupV2View() {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ elements: {}, title: 'current' } as unknown as ReturnType<typeof view.getSaveModel>);
    jest
      .spyOn(view, 'getDashboard')
      .mockReturnValue({ state: { uid: 'abc-123' } } as unknown as ReturnType<typeof view.getDashboard>);
    return view;
  }

  it('accepts spec-only edits to a v2 resource envelope', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({
        kind: 'Dashboard',
        metadata: { name: 'abc-123' },
        spec: { elements: {}, title: 'edited' },
      }),
    });

    expect(view.validateEditedResource()).toEqual({ success: true });
  });

  it('rejects changes to the resource kind', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({ kind: 'NotADashboard', metadata: { name: 'abc-123' }, spec: { elements: {} } }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects changes to metadata.name (identifier)', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({ kind: 'Dashboard', metadata: { name: 'changed' }, spec: { elements: {} } }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects unsupported metadata edits (e.g. labels)', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({
        kind: 'Dashboard',
        metadata: { name: 'abc-123', labels: { foo: 'bar' } },
        spec: { elements: {} },
      }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('skips envelope validation for v1 dashboards', () => {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ title: 'v1 dashboard' } as unknown as ReturnType<typeof view.getSaveModel>);
    view.setState({ jsonText: JSON.stringify({ title: 'v1 dashboard', panels: [] }) });

    expect(view.validateEditedResource()).toEqual({ success: true });
  });
});
