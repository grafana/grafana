import { ActionModel, Field, LinkModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipItem,
  VizTooltipHeader,
  VizTooltipWrapper,
} from '@grafana/ui/internal';

export interface Props {
  items: VizTooltipItem[];
  links?: LinkModel[];
  isPinned: boolean;
  maxHeight?: number;
  actions: Array<ActionModel<Field>>;
}

export const ExemplarTooltip = ({ items, links, isPinned, maxHeight, actions }: Props) => {
  const timeItem = items.find((val) => val.label === 'Time');

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader
        item={{
          label: t('exemplar-tooltip-header', 'Exemplar'),
          value: timeItem?.value ?? '',
        }}
        isPinned={isPinned}
      />
      <VizTooltipContent
        items={items.filter((item) => item !== timeItem)}
        isPinned={isPinned}
        maxHeight={maxHeight}
        scrollable={maxHeight != null}
      />
      <VizTooltipFooter actions={actions} dataLinks={links ?? []} />
    </VizTooltipWrapper>
  );
};
