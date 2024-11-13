import { logInfo } from '@grafana/runtime';

/**
 * This function logs a warning if the amount of items exceeds the recommended amount.
 *
 * @param amount
 * @param id
 * @param ariaLabelledBy
 */
export function logOptions(
  amount: number,
  recommendedAmount: number,
  id: string | undefined,
  ariaLabelledBy: string | undefined
): void {
  if (amount > recommendedAmount) {
    const msg = `[Combobox] Items exceed the recommended amount ${recommendedAmount}.`;
    console.warn(msg);
    try {
      logInfo(msg, {
        itemsCount: '' + amount,
        recommendedAmount: '' + recommendedAmount,
        'aria-labelledby': ariaLabelledBy ?? '',
        id: id ?? '',
      });
    } catch (e) {
      console.warn('Failed to log faro event!');
    }
  }
}
