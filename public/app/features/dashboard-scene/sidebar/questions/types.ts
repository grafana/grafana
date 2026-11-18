import { type DashboardScene } from '../../scene/DashboardScene';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { type TabItem } from '../../scene/layout-tabs/TabItem';

/** The dashboard, row, or tab that questions are saved on. */
export type QuestionsOwner = DashboardScene | RowItem | TabItem;

/**
 * Which of them it is. Passed alongside the owner rather than read with `instanceof`, so these modules don't import
 * the row and tab classes, whose editors import them.
 */
export type QuestionsOwnerKind = 'dashboard' | 'row' | 'tab';
