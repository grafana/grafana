import { usePluginComponent } from '@grafana/runtime';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

// The props below are transcribed from grafana/irm: there is no package to import them from, and
// usePluginComponent's generic is asserted by the caller.
export const ATTACH_TO_INCIDENT_COMPONENT_ID = 'grafana-irm-app/attach-to-incident-modal/v1';
export const DECLARE_INCIDENT_COMPONENT_ID = 'grafana-irm-app/declare-incident-modal/v1';

/** Narrowed to the part we read. */
export interface AttachToIncidentFormData {
  selectedIncident: {
    incident: {
      incidentID: string;
      title?: string;
    } | null;
  } | null;
}

export interface AttachToIncidentFormProps {
  onDismiss?: () => void;
  /** Defaults to window.location.href if omitted, so always pass the notebook's own. */
  attachURL?: string;
  /** Whatever the caption ends as becomes the attachment's label in IRM. */
  defaultCaption?: string;
  onAttach?: (data: AttachToIncidentFormData) => void;
}

export interface DeclareIncidentFormProps {
  onDismiss?: () => void;
  attachURL?: string;
  attachCaption?: string;
  defaultTitle?: string;
}

/**
 * Whether IRM's incident components are here to render. usePluginComponent hands back null when the
 * plugin is absent, disabled, or still resolving, so no separate probe is needed — which also means
 * the controls appear a beat after first paint rather than being there from the start.
 *
 * Null is also the answer on a stack still using the legacy grafana-incident-app, which never
 * exposed these ids.
 */
export function useNotebookIncidents() {
  const attach = usePluginComponent<AttachToIncidentFormProps>(ATTACH_TO_INCIDENT_COMPONENT_ID);
  const declare = usePluginComponent<DeclareIncidentFormProps>(DECLARE_INCIDENT_COMPONENT_ID);

  return {
    pluginId: SupportedPlugin.Irm,
    AttachToIncidentForm: attach.component,
    DeclareIncidentForm: declare.component,
    /** Whether either control has anything to render, for the overflow menu's gate. */
    available: Boolean(attach.component || declare.component),
  };
}
