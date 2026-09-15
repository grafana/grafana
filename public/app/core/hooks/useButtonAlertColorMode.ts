import { useStoredString } from './useStored';

export const BUTTON_ALERT_COLOR_MODE_KEY = 'grafana.buttonAlertColorMode';

/**
 * Design experiment: how solid buttons, outline buttons, and alerts of the same severity relate to
 * each other's color.
 *  - 'same': solid buttons and alerts share a color; outline buttons are unaffected.
 *  - 'subtleAlert': alerts use a more subtle, darker background/border than the matching solid button.
 *  - 'subtleAlertAndOutline': same as 'subtleAlert', and outline buttons also adopt that subtle
 *    background/border instead of a transparent background with a solid-color border.
 */
export type ButtonAlertColorMode = 'same' | 'subtleAlert' | 'subtleAlertAndOutline';

const isButtonAlertColorMode = (value: string): value is ButtonAlertColorMode =>
  value === 'same' || value === 'subtleAlert' || value === 'subtleAlertAndOutline';

export const useButtonAlertColorMode = (): [ButtonAlertColorMode, (mode: ButtonAlertColorMode) => void] => {
  const [stored, setStored] = useStoredString(BUTTON_ALERT_COLOR_MODE_KEY, 'same');
  const mode = isButtonAlertColorMode(stored) ? stored : 'same';
  return [mode, setStored];
};
