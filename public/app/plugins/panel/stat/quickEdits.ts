import { presetsQuickEdit, type PanelQuickEdit, thresholdsQuickEdit, unitQuickEdit } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueTextMode } from '@grafana/schema';

import { calculationQuickEdit } from './common';
import { type Options } from './panelcfg.gen';

/** The stat options people change most, most changed first. */
export function getStatQuickEdits(): Array<PanelQuickEdit<Options>> {
  return [
    thresholdsQuickEdit(),
    presetsQuickEdit(),
    unitQuickEdit(),
    calculationQuickEdit(),
    {
      id: 'color',
      title: t('stat.quick-edits.color', 'Color'),
      icon: 'circle',
      optionIds: ['colorMode', 'graphMode'],
      summary: ({ options }) => ({ text: getColorModeLabel(options.colorMode) }),
    },
    {
      id: 'text',
      title: t('stat.quick-edits.text', 'Text'),
      icon: 'text-fields',
      optionIds: ['textMode', 'text.valueSize', 'text.titleSize', 'orientation'],
      summary: ({ options }) => ({ text: getTextModeLabel(options.textMode) }),
    },
  ];
}

function getColorModeLabel(mode: BigValueColorMode | undefined): string {
  switch (mode) {
    case BigValueColorMode.None:
      return t('stat.color-mode-options.label-none', 'None');
    case BigValueColorMode.Background:
      return t('stat.color-mode-options.label-background-gradient', 'Background Gradient');
    case BigValueColorMode.BackgroundSolid:
      return t('stat.color-mode-options.label-background-solid', 'Background Solid');
    default:
      return t('stat.color-mode-options.label-value', 'Value');
  }
}

function getTextModeLabel(mode: BigValueTextMode | undefined): string {
  switch (mode) {
    case BigValueTextMode.Value:
      return t('stat.text-mode-options.label-value', 'Value');
    case BigValueTextMode.ValueAndName:
      return t('stat.text-mode-options.label-value-and-name', 'Value and name');
    case BigValueTextMode.Name:
      return t('stat.text-mode-options.label-name', 'Name');
    case BigValueTextMode.None:
      return t('stat.text-mode-options.label-none', 'None');
    default:
      return t('stat.text-mode-options.label-auto', 'Auto');
  }
}
