import React from 'react';
import { useLocalStorage } from 'react-use';
import { FeatureInfoBox, FeatureInfoBoxProps } from './FeatureInfoBox';

export const FEATUREINFOBOX_PERSISTENCE_ID_PREFIX = 'grafana-ui.components.InfoBox.FeatureInfoBox';

export interface DismissableFeatureInfoBoxProps extends FeatureInfoBoxProps {
  /** Unique id under which this instance will be persisted. */
  persistenceId: string;
}

/**
  @internal
  Wraps FeatureInfoBox and perists if a user has dismissed the box in local storage.
 */
export const DismissableFeatureInfoBox = React.memo(
  React.forwardRef<HTMLDivElement, DismissableFeatureInfoBoxProps>(
    ({ persistenceId, onDismiss, ...otherProps }, ref) => {
      const localStorageKey = FEATUREINFOBOX_PERSISTENCE_ID_PREFIX.concat(persistenceId);

      const [dismissed, setDismissed] = useLocalStorage(localStorageKey, { isDismissed: false });

      const dismiss = () => {
        setDismissed({ isDismissed: true });
        if (onDismiss) {
          onDismiss();
        }
      };

      if (dismissed.isDismissed) {
        return null;
      }
      return <FeatureInfoBox onDismiss={dismiss} ref={ref} {...otherProps}></FeatureInfoBox>;
    }
  )
);
DismissableFeatureInfoBox.displayName = 'DismissableFeatureInfoBox';
