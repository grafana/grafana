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
 * Stands in for IRM's exposed components, which are not installed under test. Records the props it
 * was handed and fires the callback the real form would.
 */
export function stubAttachForm(incidentTitle = 'Checkout 5xx spike') {
  const props: AttachToIncidentFormProps[] = [];
  const attached: AttachToIncidentFormData = {
    selectedIncident: { incident: { incidentID: '101', title: incidentTitle } },
  };

  const Stub: ComponentType<AttachToIncidentFormProps> = (received) => {
    props.push(received);
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
  return {
    pluginId: SupportedPlugin.Irm,
    AttachToIncidentForm: null,
    DeclareIncidentForm: null,
    // Derived to match the hook, but still overridable — a caller asking for the two to disagree is
    // testing that state deliberately.
    available: Boolean(overrides.AttachToIncidentForm || overrides.DeclareIncidentForm),
    ...overrides,
  };
}
