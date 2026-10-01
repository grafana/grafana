import { renderHook } from 'test/test-utils';

import { usePluginComponent } from '@grafana/runtime';

import {
  ATTACH_TO_INCIDENT_COMPONENT_ID,
  DECLARE_INCIDENT_COMPONENT_ID,
  useNotebookIncidents,
} from './useNotebookIncidents';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const mockUsePluginComponent = jest.mocked(usePluginComponent);

/** Answers per component id, so the two can be present independently. */
function setComponents(byId: Record<string, boolean>) {
  const Stub = () => null;
  mockUsePluginComponent.mockImplementation((id: string) => ({
    component: byId[id] ? Stub : null,
    isLoading: false,
  }));
}

describe('useNotebookIncidents', () => {
  it('asks for IRM’s two exposed modals by id', () => {
    setComponents({});

    renderHook(() => useNotebookIncidents());

    expect(mockUsePluginComponent).toHaveBeenCalledWith(ATTACH_TO_INCIDENT_COMPONENT_ID);
    expect(mockUsePluginComponent).toHaveBeenCalledWith(DECLARE_INCIDENT_COMPONENT_ID);
  });

  // Also what a legacy grafana-incident-app stack returns: it never exposed these ids.
  it('is unavailable when IRM exposes neither', () => {
    setComponents({});

    const { result } = renderHook(() => useNotebookIncidents());

    expect(result.current.available).toBe(false);
    expect(result.current.AttachToIncidentForm).toBeNull();
    expect(result.current.DeclareIncidentForm).toBeNull();
  });

  // Per component, so a stack exposing only one still offers it.
  it('reports each component on its own', () => {
    setComponents({ [ATTACH_TO_INCIDENT_COMPONENT_ID]: true });

    const { result } = renderHook(() => useNotebookIncidents());

    expect(result.current.available).toBe(true);
    expect(result.current.AttachToIncidentForm).not.toBeNull();
    expect(result.current.DeclareIncidentForm).toBeNull();
  });
});
