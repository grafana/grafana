import { type ContactPoint, ContactPointSelector } from '@grafana/alerting/unstable';

import { AlertingPageWrapper } from '../unified/components/AlertingPageWrapper';

const Experiments = () => {
  const handleChange = (option: ContactPoint) => {
    console.log(option);
  };

  return (
    <AlertingPageWrapper>
      <ContactPointSelector onChange={handleChange} />
    </AlertingPageWrapper>
  );
};

export default Experiments;
