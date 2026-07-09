import { type DataSourceInstanceSettings } from '@grafana/data';
import { type IconName } from '@grafana/ui';

import { type DatasourceCapabilities } from './capabilities';

/**
 * A single exploration option surfaced after we scan the selected datasource.
 * Represents a label dimension (e.g. `service`, `namespace`, `job`) that the
 * Assistant can use as the primary axis for a generated dashboard.
 */
export interface ExplorationOption {
  /** Stable identifier — usually the label key itself. */
  id: string;
  /** Human-readable title shown on the row (e.g. "Services"). */
  title: string;
  /** Generic category description (e.g. "Named apps or APIs"), used when no samples are available. */
  description: string;
  /** The underlying label key on the datasource (e.g. `service_name`). */
  labelKey: string;
  /** A handful of example values to preview what the dimension contains. */
  sampleValues?: string[];
  /**
   * Other label keys that mapped to the same category and were collapsed into this row
   * (e.g. `pod_name`, `k8s_pod_name` merged under a primary `pod`). Handed to the Assistant
   * so it can fall back if the primary key isn't the one that carries the metrics.
   */
  mergedLabelKeys?: string[];
}

/**
 * A well-known observability dashboard "shape" the user can pick after
 * choosing a dimension. Intents are not static panel JSON — they're a name +
 * short description + LLM guidance that the Assistant expands into an actual
 * dashboard using its dashboarding-mode tools.
 */
export interface DashboardIntent {
  /** Stable identifier (e.g. `service-health`). */
  id: string;
  /** Row title (e.g. "Service health"). */
  title: string;
  /** One or two sentence description shown to the user under the title. */
  description: string;
  /**
   * Longer instructions for the LLM about what this intent should include,
   * expressed in generic observability terms so it works across data sources.
   */
  guidance: string;
  /** Icon rendered as a preview next to the intent title. */
  icon: IconName;
}

/**
 * A single user pick: an intent paired with the dimension it pivots on. The modal
 * lets users assemble several of these across different groups (e.g. a "Service
 * health" intent on `service` plus a "Pod resources" intent on `pod`), so every
 * selection has to remember its own pivot rather than sharing one global dimension.
 */
export interface IntentSelection {
  intent: DashboardIntent;
  option: ExplorationOption;
}

/**
 * A snapshot of what we learned about the selected datasource. Passed straight
 * through to the Assistant handoff so the LLM starts with real cardinality data
 * instead of guessing about label names/values.
 */
export interface DatasourceAnalysis {
  /** All label keys we discovered, ordered by usefulness (see `prioritizeLabelKeys`). */
  labelKeys: string[];
  /** Sample values keyed by label — populated for the top labels only. */
  labelSamples: Record<string, string[]>;
  /** Ready-to-render exploration options derived from `labelKeys` + `labelSamples`. */
  options: ExplorationOption[];
  /** What kind of exporters / conventions / integrations we detected on this datasource. */
  capabilities: DatasourceCapabilities;
}

/**
 * High-level status of the datasource analysis step. The modal is a single
 * screen (no wizard), so we drive the UI off two independent phases —
 * analysis (below) and generation — rather than a linear step list.
 */
export type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * High-level status of the dashboard generation step. Same reasoning as
 * {@link AnalysisStatus}: independent from analysis so the user can e.g.
 * still browse chips while a generation is in flight.
 */
export type GenerationStatus = 'idle' | 'loading' | 'error';

/**
 * Optional user-supplied customizations layered on top of the dimension + intent.
 * All fields default to sensible values in the modal so the user can generate
 * without opening the customization panel.
 */
export interface CustomizationOptions {
  /** Free-text notes the user wants the LLM to incorporate (focus areas, constraints, tone). */
  additionalNotes: string;
}

/**
 * Broad "entry path" the user chose in the modal. `beginner` prioritises curated
 * top picks and one-click generation; `expert` widens the aperture — full
 * category browsing, multi-select — and steers the LLM toward more advanced,
 * detail-heavy dashboards.
 */
export type WizardMode = 'beginner' | 'expert';

/**
 * Orientation of the dashboard the user wants to build:
 * - `technical`: SRE / SDE-oriented (RED/USE, saturation, error budgets, runtime).
 * - `business`: outcome-oriented KPIs (revenue, signups, conversion, orders).
 * - `both`: mix technical panels with business-oriented ones.
 *
 * Threaded through to the LLM so it can pick appropriate panel titles, units and
 * groupings, and to the local composer so its fallback panels reflect the choice.
 */
export type DashboardOrientation = 'technical' | 'business' | 'both';

/**
 * Extra structured signals the modal collects before intent generation runs.
 * The `refinement` field carries a free-form user description of what dashboard
 * they want ("show me revenue by region and error rate by service") — the LLM
 * uses it to filter which intents to propose and to bias intent guidance
 * toward the user's target subject.
 */
export interface IntentGenerationContext {
  mode: WizardMode;
  orientation: DashboardOrientation;
  refinement: string;
}

/**
 * A semantic group of intents generated (or curated) for the current
 * datasource — e.g. "Apps & Services", "Databases", "Business KPIs". Categories
 * are produced by the LLM based on what's actually present in the data instead
 * of being pinned to raw label dimensions.
 */
export interface GeneratedCategoryGroup {
  /** Stable kebab-case id, unique across the response. */
  id: string;
  /** Human-readable category title (e.g. "Apps & Services"). */
  title: string;
  /** Icon shown next to the title in the UI. */
  icon: string;
  /** Optional short description shown under the title. */
  description?: string;
  /** Selections belonging to this category, in the order the LLM returned them. */
  selections: IntentSelection[];
}

export interface GenerateDashboardWizardState {
  analysisStatus: AnalysisStatus;
  generationStatus: GenerationStatus;
  datasources: DataSourceInstanceSettings[];
  analysis?: DatasourceAnalysis;
  selectedOption?: ExplorationOption;
  customization: CustomizationOptions;
  errorMessage?: string;
}
