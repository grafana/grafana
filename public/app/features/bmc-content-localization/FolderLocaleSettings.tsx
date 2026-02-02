// BMC File
// Co Authored by : kchidrawar, ymulthan
import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { Button, Field, Input, Select, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ENGLISH_US } from 'app/core/internationalization/constants';

import { getLocalizationSrv } from '../dashboard/services/LocalizationSrv';

import { LanguageCode, LanguageOptions } from './types';

const FolderLocaleSettings = ({ resourceUID, folderName }: { resourceUID: string; folderName: string }) => {
  const styles = useStyles2(getStyles);
  const [language, setLanguage] = useState<LanguageCode>(ENGLISH_US);
  const [value, setValue] = useState<string>();
  const [loading, setLoading] = useState<boolean>(true);

  const onSave = async () => {
    if (!value) {
      return;
    }
    setLoading(true);
    try {
      await getLocalizationSrv().SaveLocalesJsonByLang(resourceUID, language, { name: value });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (value: LanguageCode) => {
    setLanguage(value);
  };

  const handleValueChange = (value: string) => {
    setValue(value);
  };

  const getLocalizedValue = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLocalizationSrv().GetLocalesJsonByLangAndUID(resourceUID, language);
      setValue(result.name ?? '');
    } catch (error) {
      console.error('Failed to fetch localized value:', error);
    } finally {
      setLoading(false);
    }
  }, [resourceUID, language]);

  useEffect(() => {
    getLocalizedValue();
  }, [getLocalizedValue]);

  return (
    <div className={styles.form}>
      <div className={styles.header}>
        <Select
          className={styles.select}
          options={LanguageOptions()}
          onChange={(e) => handleLanguageChange(e.value as LanguageCode)}
          value={language}
          width={25}
        />
      </div>
      <Field label={t('bmc.manage-locales.folders.folder-title', 'Folder title')}>
        <Input
          type="text"
          onChange={(e) => handleValueChange(e.currentTarget.value)}
          value={value}
          placeholder={folderName}
          loading={loading}
        />
      </Field>
      <Button onClick={() => onSave()} variant="primary" disabled={loading}>
        <Trans i18nKey="bmc.common.save">Save</Trans>
      </Button>
    </div>
  );
};

const getStyles = () => ({
  form: css`
    position: relative;
    padding-top: 70px;
    text-align: left;
  `,
  header: css`
    display: flex;
    position: absolute;
    top: 10px;
    right: 10px;
    justify-content: space-between;
    align-items: right;
    width: 100%;
  `,
  select: css`
    height: 30px;
    margin-left: 10px;
    padding: 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    font-width: bold;
  `,
});

export default FolderLocaleSettings;
