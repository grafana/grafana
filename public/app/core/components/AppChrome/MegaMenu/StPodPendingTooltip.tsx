import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Tooltip } from '@grafana/ui';

interface Props {
  itemName: string;
  show: boolean;
  className?: string;
  children: ReactNode;
}

// Tooltip forces tabIndex={0} on its child; the row's own link and controls are the real tab stops.
const TooltipAnchor = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} {...props} tabIndex={undefined} />
));
TooltipAnchor.displayName = 'TooltipAnchor';

export function StPodPendingTooltip({ itemName, show, className, children }: Props) {
  return (
    <Tooltip
      placement="right"
      // A controlled `false` keeps the tooltip closed; `undefined` leaves it on hover/focus.
      show={show ? undefined : false}
      content={t('app-chrome.st-loading.background-tooltip', 'Preparing {{itemName}}', {
        itemName,
        interpolation: { escapeValue: false },
      })}
    >
      <TooltipAnchor className={className}>{children}</TooltipAnchor>
    </Tooltip>
  );
}
