import { t } from '@grafana/i18n';
import { Box, LoadingPlaceholder } from '@grafana/ui';

interface Props {
  text?: string;
}

const PageLoader = ({ text }: Props) => {
  const loadingText = text ?? t('page-loader.default', 'Loading ...');
  return (
    <Box display="flex" alignItems="center" direction="column" justifyContent="center" paddingTop={10}>
      <LoadingPlaceholder text={loadingText} />
    </Box>
  );
};

export default PageLoader;
