import { t } from '@grafana/i18n';

export type FolderBulkRuleAction = 'pause' | 'resume' | 'delete';

/**
 * What a folder-level bulk rule action did.
 *
 * `affected` counts the rules the action succeeded on. `skipped` counts the rules it left alone because
 * they belong to a provisioned rule group — those can't be paused, resumed or deleted this way.
 *
 * Both are optional because an older backend may reply with just `{ message }`. The frontend and backend
 * deploy separately, so a new frontend can briefly be talking to a backend that doesn't send counts yet.
 * We only have counts to report when the backend sends them.
 */
export interface BulkActionResults {
  affected?: number;
  skipped?: number;
}

/**
 * Builds the toast message shown after a folder-level bulk rule action (pause/resume/delete all rules).
 *
 * When the backend didn't send an `affected` count we show the older message that mentions no numbers,
 * rather than reading the missing count as zero and wrongly claiming nothing happened.
 */
export function getFolderActionResultMessage(action: FolderBulkRuleAction, results: BulkActionResults = {}) {
  const { affected, skipped } = results;

  if (affected === undefined) {
    switch (action) {
      case 'pause':
        return t('alerting.bulk-actions.pause.success', 'Rules evaluation successfully paused for folder') + '.';
      case 'resume':
        return t('alerting.bulk-actions.unpause.success', 'Rules successfully resumed for folder') + '.';
      case 'delete':
        return t('alerting.bulk-actions.delete.success', 'Rules successfully deleted from folder') + '.';
    }
  }

  const sentences: string[] = [];

  switch (action) {
    case 'pause':
      sentences.push(
        affected === 0
          ? t('alerting.bulk-actions.pause.no-rules-affected', 'No rules were paused for folder')
          : t('alerting.bulk-actions.pause.success', 'Rules evaluation successfully paused for folder')
      );
      if (affected > 0) {
        sentences.push(t('alerting.bulk-actions.pause.affected-count', 'Paused {{num}} rules', { num: affected }));
      }
      break;
    case 'resume':
      sentences.push(
        affected === 0
          ? t('alerting.bulk-actions.unpause.no-rules-affected', 'No rules were resumed for folder')
          : t('alerting.bulk-actions.unpause.success', 'Rules successfully resumed for folder')
      );
      if (affected > 0) {
        sentences.push(t('alerting.bulk-actions.unpause.affected-count', 'Resumed {{num}} rules', { num: affected }));
      }
      break;
    case 'delete':
      sentences.push(
        affected === 0
          ? t('alerting.bulk-actions.delete.no-rules-affected', 'No rules were deleted from folder')
          : t('alerting.bulk-actions.delete.success', 'Rules successfully deleted from folder')
      );
      if (affected > 0) {
        sentences.push(t('alerting.bulk-actions.delete.affected-count', 'Deleted {{num}} rules', { num: affected }));
      }
      break;
  }

  if (skipped) {
    sentences.push(
      t('alerting.bulk-actions.skipped-provisioned', 'Skipped {{num}} provisioned rules', { num: skipped })
    );
  }

  return sentences.map((sentence) => `${sentence}.`).join(' ');
}
