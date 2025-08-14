import { FC, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import Validators from 'app/percona/shared/helpers/validators';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';

const MysqlExtraDSNParams: FC = () => {
  const extraDnsParams = useMemo(() => [Validators.validateKeyValue], []);
  const styles = useStyles2(getStyles);

  return (
    <TextareaInputField
      name="extra_dsn_params"
      label={
        <div>
          <label htmlFor="input-extra_dsn_params-id">{Messages.form.labels.mysqlDetails.extraDsnParams}</label>
          <p className={styles.description}>{Messages.form.descriptions.extraDsnParams}</p>
        </div>
      }
      placeholder={Messages.form.placeholders.labels.extraDsnParams}
      validators={extraDnsParams}
    />
  );
};

export default MysqlExtraDSNParams;
