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
