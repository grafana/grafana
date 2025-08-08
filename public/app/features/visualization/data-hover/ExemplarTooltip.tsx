import { LinkModel } from '@grafana/data';
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
  headerLabel?: string;
  maxHeight?: number;
}

export const ExemplarTooltip = ({ items, links, isPinned, headerLabel = 'Exemplar', maxHeight }: Props) => {
  const timeItem = items.find((val) => val.label === 'Time');

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader
        item={{
          label: headerLabel,
          value: timeItem?.label ?? '',
        }}
        isPinned={isPinned}
      />
      <VizTooltipContent
        items={items.filter((item) => item !== timeItem)}
        isPinned={isPinned}
        maxHeight={maxHeight}
        scrollable={maxHeight != null}
      />
      <VizTooltipFooter dataLinks={links ?? []} />
    </VizTooltipWrapper>
  );
};
