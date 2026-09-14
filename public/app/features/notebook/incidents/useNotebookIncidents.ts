import { usePluginComponent } from '@grafana/runtime';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

/**
 * The IRM components this feature renders. Exposed components are addressed by id and their props
 * are the plugin's own, so the contracts below are transcribed from grafana/irm rather than
 * imported — there is no package to import them from, and `usePluginComponent`'s generic is
 * asserted by the caller.
 *
 * Neither component draws modal chrome; both are form bodies their host wraps. IRM's own dashboard
 * entry point does this with openModal({ title, body }), which is why the modal looks like core's.
 */
export const ATTACH_TO_INCIDENT_COMPONENT_ID = 'grafana-irm-app/attach-to-incident-modal/v1';
export const DECLARE_INCIDENT_COMPONENT_ID = 'grafana-irm-app/declare-incident-modal/v1';

/** What `onAttach` reports back, narrowed to the part we read. */
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
  /** Prefills the caption field. Whatever it ends as becomes the attachment's label in IRM. */
  defaultCaption?: string;
  onAttach?: (data: AttachToIncidentFormData) => void;
}

export interface DeclareIncidentFormProps {
  onDismiss?: () => void;
  /** Attached to the incident the form creates, and labelled by attachCaption. */
  attachURL?: string;
  attachCaption?: string;
  defaultTitle?: string;
}

/**
 * Whether IRM's incident components are here to render.
 *
 * `usePluginComponent` answers this on its own: it loads the app plugin when needed and hands back
 * a null component when IRM is absent or disabled. That replaces the settings probe and page-access
 * check this hook used to do — those existed to decide whether a link to a plugin *page* was safe
 * to offer, and neither entry point navigates to one any more.
 *
 * Null is also what a stack still on the legacy grafana-incident-app returns, since the component
 * ids are IRM's. That is the right answer rather than a gap: the legacy app never exposed them.
 */
export function useNotebookIncidents() {
  const attach = usePluginComponent<AttachToIncidentFormProps>(ATTACH_TO_INCIDENT_COMPONENT_ID);
  const declare = usePluginComponent<DeclareIncidentFormProps>(DECLARE_INCIDENT_COMPONENT_ID);

  return {
    // A constant now rather than a probe result: these components only exist on an IRM install, so
    // there is no legacy plugin id for the incident links to be built against.
    pluginId: SupportedPlugin.Irm,
    AttachToIncidentForm: attach.component,
    DeclareIncidentForm: declare.component,
    /** Whether either control has anything to render. Used for the overflow menu's own gate. */
    available: Boolean(attach.component || declare.component),
  };
}
