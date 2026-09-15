import { BusEventWithPayload } from '@grafana/data';

/**
 * The user's current nav customisation, sent with the feedback event so the survey can attribute
 * responses to how the menu is actually set up. Item identity is heterogeneous (matching what each
 * store keeps): hidden items and section order are keyed by nav id (falling back to url), pinned
 * items by url — the survey treats each as an opaque string.
 */
export interface CustomizableNavFeedbackPayload {
  hiddenItems: string[];
  pinnedItems: string[];
  sectionOrder: string[];
}

/**
 * Published on the app event bus when the user clicks "Give feedback" in the customisable mega menu.
 * The grafana-setupguide-app plugin listens for this to trigger the "Customisable navigation
 * feedback" survey, so the `type` string and payload shape are a wire contract with that plugin and
 * must not change without coordinating there.
 */
export class CustomizableNavFeedbackEvent extends BusEventWithPayload<CustomizableNavFeedbackPayload> {
  static type = 'customizable-nav-feedback';
}
