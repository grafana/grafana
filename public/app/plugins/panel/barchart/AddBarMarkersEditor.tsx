import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

export const AddBarMarkersEditor = ({ value, onChange }: StandardEditorProps<boolean>) => {
  const handleClick = () => {
    // Placeholder for future implementation
    console.log('Add Marker button clicked');
  };

  return (
    <Button onClick={handleClick}>
      {t('barchart.barmarkers-editor.add-marker', 'Add Marker +')}
    </Button>
  );
};
