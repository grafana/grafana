import { Box, LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';
interface Props {
  pageName?: string;
}

const PageLoader = ({ pageName = '' }: Props) => {
  // BMC code - added support for localization
  const loadingText = `${t('bmcgrafana.page-loader.text', 'Loading')} ${pageName}...`;
  return (
    <Box display="flex" alignItems="center" direction="column" justifyContent="center" paddingTop={10}>
      <LoadingPlaceholder text={loadingText} />
    </Box>
  );
};

export default PageLoader;
