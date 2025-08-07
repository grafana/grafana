import { LinkModel } from '@grafana/data';
import { VizTooltipOptions } from '@grafana/schema/dist/esm/common/common.gen';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipItem,
  VizTooltipHeader,
  VizTooltipWrapper,
} from '@grafana/ui/internal';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

import { DisplayValue } from './DataHoverView';

export interface Props {
  displayValues: DisplayValue[];
  links?: LinkModel[];
  tooltipOptions?: VizTooltipOptions;
  isPinned: boolean;
  headerLabel?: string;
}

export const ExemplarTooltip = ({ displayValues, links, isPinned, headerLabel = 'Exemplar' }: Props) => {
  const time = displayValues.find((val) => val.name === 'Time');

  const headerItem: VizTooltipItem = {
    label: headerLabel,
    value: time ? time.valueString : '',
  };

  let contentItems: VizTooltipItem[] = [];
  displayValues.forEach((displayValue) => {
    contentItems.push({
      label: displayValue.name,
      value: renderValue(displayValue.valueString),
      isActive: displayValue.highlight,
    });
  });

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent items={contentItems} isPinned={isPinned} />
      <VizTooltipFooter dataLinks={links || []} />
    </VizTooltipWrapper>
  );
};
