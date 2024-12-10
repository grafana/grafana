import { useState } from 'react';

import { CollapsableSection, Stack } from '@grafana/ui';

import { CommunityTemplateList } from './CommunityTemplateList';
import { OrgTemplateList } from './OrgTemplateList';

interface TemplateListProps {}

export function TemplateList({}: TemplateListProps) {
  const [orgSectionOpen, setOrgSectionOpen] = useState(true);
  const [communitySectionOpen, setCommunitySectionOpen] = useState(true);

  return (
    <Stack direction="column">
      <CollapsableSection label="Organization Templates" isOpen={orgSectionOpen} onToggle={setOrgSectionOpen}>
        <OrgTemplateList></OrgTemplateList>
      </CollapsableSection>
      <CollapsableSection label="Community Templates" isOpen={communitySectionOpen} onToggle={setCommunitySectionOpen}>
        <CommunityTemplateList></CommunityTemplateList>
      </CollapsableSection>
    </Stack>
  );
}
