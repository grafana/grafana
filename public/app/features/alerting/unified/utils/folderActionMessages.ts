import { t } from '@grafana/i18n';

export type FolderBulkRuleAction = 'pause' | 'resume' | 'delete';

/**
 * Builds the toast message shown after a folder-level bulk rule action (pause/resume/delete all rules).
 *
 * `affected` is the number of rules that were successfully acted upon, and `skipped` is the number of
 * rules that were skipped because they belong to a provisioned rule group (provisioned rules cannot be
 * paused/resumed/deleted through this action).
 *
 * `affected`/`skipped` are optional because the backend response may not include them yet: frontend and
 * backend deploy independently, so a newer frontend can briefly talk to an older backend that only
 * returns `{ message }`. In that case we fall back to the original count-less message instead of
 * treating the missing fields as zero, which would incorrectly claim nothing was affected.
 */
export function getFolderActionResultMessage(action: FolderBulkRuleAction, affected?: number, skipped?: number) {
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
