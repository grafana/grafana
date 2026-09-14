import { type ComponentType } from 'react';

import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import {
  type AttachToIncidentFormData,
  type AttachToIncidentFormProps,
  type DeclareIncidentFormProps,
  type useNotebookIncidents,
} from './useNotebookIncidents';

export const STUB_ATTACH_TESTID = 'stub-attach-form';
export const STUB_DECLARE_TESTID = 'stub-declare-form';

/**
 * Stands in for IRM's exposed components, which are not installed in the test environment.
 *
 * Each stub records the props it was handed and renders a control that fires the callback the real
 * form would, so the tests assert the contract in `useNotebookIncidents` — the notebook's identity
 * going in, and the attach result coming back — rather than anything about IRM's own UI.
 */
export function stubAttachForm() {
  const props: AttachToIncidentFormProps[] = [];
  const attached: AttachToIncidentFormData = {
    selectedIncident: { incident: { incidentID: '101', title: 'Checkout 5xx spike' } },
  };

  const Stub: ComponentType<AttachToIncidentFormProps> = (received) => {
    props.push(received);
    // Identified by testid rather than copy: a stub has no user-facing text to translate.
    return <button type="button" data-testid={STUB_ATTACH_TESTID} onClick={() => received.onAttach?.(attached)} />;
  };

  return { Stub, props };
}

export function stubDeclareForm() {
  const props: DeclareIncidentFormProps[] = [];

  const Stub: ComponentType<DeclareIncidentFormProps> = (received) => {
    props.push(received);
    return <div data-testid={STUB_DECLARE_TESTID} />;
  };

  return { Stub, props };
}

type Incidents = ReturnType<typeof useNotebookIncidents>;

/** The hook's answer, defaulting to "IRM is not installed". */
export function notebookIncidents(overrides: Partial<Incidents> = {}): Incidents {
  const value: Incidents = {
    pluginId: SupportedPlugin.Irm,
    AttachToIncidentForm: null,
    DeclareIncidentForm: null,
    available: false,
    ...overrides,
  };

  return { ...value, available: Boolean(value.AttachToIncidentForm || value.DeclareIncidentForm) };
}
