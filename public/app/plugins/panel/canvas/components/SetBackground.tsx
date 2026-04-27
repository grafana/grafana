import { css } from '@emotion/css';
import { useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { ResourceDimensionMode } from '@grafana/schema';
import { Portal } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui/themes';
import { type Scene } from 'app/features/canvas/runtime/scene';
import { ResourcePickerPopover } from 'app/features/dimensions/editors/ResourcePickerPopover';
import { MediaType, ResourceFolderName } from 'app/features/dimensions/types';

import { type AnchorPoint } from '../types';

type Props = {
  onClose: () => void;
  scene: Scene;
  anchorPoint: AnchorPoint;
};

export function SetBackground({ onClose, scene, anchorPoint }: Props) {
  const defaultValue = scene.root.options.background?.image?.fixed ?? '';

  const [bgImage, setBgImage] = useState(defaultValue);
  const theme = useTheme2();
  const styles = getStyles(theme, anchorPoint);

  const onChange = (value: string | undefined) => {
    if (value) {
      setBgImage(value);
      if (scene.root) {
        scene.root.options.background = {
          ...scene.root.options.background,
          image: { mode: ResourceDimensionMode.Fixed, fixed: value },
        };
        scene.revId++;
        scene.save();

        scene.root.reinitializeMoveable();
      }

      // Force a re-render (update scene data after config update)
      if (scene) {
        scene.updateData(scene.data!);
      }
    }

    onClose();
  };

  return (
    <Portal className={styles.portalWrapper}>
      <ResourcePickerPopover
        onChange={onChange}
        value={bgImage}
        mediaType={MediaType.Image}
        folderName={ResourceFolderName.IOT}
      />
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2, anchorPoint: AnchorPoint) => ({
  portalWrapper: css({
    width: '315px',
    height: '445px',
    transform: `translate(${anchorPoint.x}px, ${anchorPoint.y - 200}px)`,
  }),
});
