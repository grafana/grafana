import { act, render } from '@testing-library/react';

import { SceneDataLayerBase, type SceneDataLayerProvider, type SceneDataLayerProviderState } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DataLayerControl } from './DataLayerControl';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  })),
}));

class TestDataLayer extends SceneDataLayerBase<SceneDataLayerProviderState> implements SceneDataLayerProvider {
  public onEnable(): void {}
  public onDisable(): void {}
  protected runLayer(): void {}
}

function buildAnnotationLayer() {
  return new DashboardAnnotationsDataLayer({
    key: 'annotation-layer-key',
    name: 'test-annotation',
    isEnabled: true,
    query: {
      name: 'test-query',
      enable: true,
      iconColor: 'red',
    },
  });
}

async function renderControl(layer: SceneDataLayerProvider, inMenu?: boolean) {
  let renderResult!: ReturnType<typeof render>;

  await act(async () => {
    renderResult = render(<DataLayerControl layer={layer} inMenu={inMenu} />);
  });

  return renderResult;
}

describe('<DataLayerControl />', () => {
  it('should expose element key and annotation type on the default control', async () => {
    const { container } = await renderControl(buildAnnotationLayer());

    const wrapper = container.querySelector('[data-dashboard-element-key="annotation-layer-key"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('data-dashboard-element-type', 'annotation');
  });

  it('should expose element key and annotation type on the in-menu control', async () => {
    const { container } = await renderControl(buildAnnotationLayer(), true);

    const wrapper = container.querySelector('[data-dashboard-element-key="annotation-layer-key"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('data-dashboard-element-type', 'annotation');
  });

  it('should expose data-layer type for non-annotation layers', async () => {
    const layer = new TestDataLayer({ key: 'test-layer-key', name: 'test-layer', isEnabled: true });

    const { container } = await renderControl(layer);

    const wrapper = container.querySelector('[data-dashboard-element-key="test-layer-key"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('data-dashboard-element-type', 'data-layer');
  });
});
