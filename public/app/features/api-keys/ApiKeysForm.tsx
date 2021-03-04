import React, { ChangeEvent, FC, FormEvent, useEffect, useState } from 'react';
import { EventsWithValidation, Icon, InlineFormLabel, LegacyForms, ValidationEvents } from '@grafana/ui';
import { NewApiKey, OrgRole } from '../../types';
import { rangeUtil } from '@grafana/data';
import { SlideDown } from '../../core/components/Animations/SlideDown';

const { Input } = LegacyForms;

interface Props {
  show: boolean;
  onClose: () => void;
  onKeyAdded: (apiKey: NewApiKey) => void;
}

function isValidInterval(value: string): boolean {
  if (!value) {
    return true;
  }
  try {
    rangeUtil.intervalToSeconds(value);
    return true;
  } catch {}
  return false;
}

const timeRangeValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: isValidInterval,
      errorMessage: 'Not a valid duration',
    },
  ],
};

const tooltipText =
  'The api key life duration. For example 1d if your key is going to last for one day. All the supported units are: s,m,h,d,w,M,y';

export const ApiKeysForm: FC<Props> = ({ show, onClose, onKeyAdded }) => {
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<OrgRole>(OrgRole.Viewer);
  const [secondsToLive, setSecondsToLive] = useState<string>('');
  useEffect(() => {
    setName('');
    setRole(OrgRole.Viewer);
    setSecondsToLive('');
  }, [show]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isValidInterval(secondsToLive)) {
      onKeyAdded({ name, role, secondsToLive });
      onClose();
    }
  };
  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  };
  const onRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setRole(event.currentTarget.value as OrgRole);
  };
  const onSecondsToLiveChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSecondsToLive(event.currentTarget.value);
  };

  return (
    <SlideDown in={show}>
      <div className="gf-form-inline cta-form">
        <button className="cta-form__close btn btn-transparent" onClick={onClose}>
          <Icon name="times" />
        </button>
        <form className="gf-form-group" onSubmit={onSubmit}>
          <h5>Add API Key</h5>
          <div className="gf-form-inline">
            <div className="gf-form max-width-21">
              <span className="gf-form-label">Key name</span>
              <Input type="text" className="gf-form-input" value={name} placeholder="Name" onChange={onNameChange} />
            </div>
            <div className="gf-form">
              <span className="gf-form-label">Role</span>
              <span className="gf-form-select-wrapper">
                <select className="gf-form-input gf-size-auto" value={role} onChange={onRoleChange}>
                  {Object.keys(OrgRole).map((role) => {
                    return (
                      <option key={role} label={role} value={role}>
                        {role}
                      </option>
                    );
                  })}
                </select>
              </span>
            </div>
            <div className="gf-form max-width-21">
              <InlineFormLabel tooltip={tooltipText}>Time to live</InlineFormLabel>
              <Input
                type="text"
                className="gf-form-input"
                placeholder="1d"
                validationEvents={timeRangeValidationEvents}
                value={secondsToLive}
                onChange={onSecondsToLiveChange}
              />
            </div>
            <div className="gf-form">
              <button className="btn gf-form-btn btn-primary">Add</button>
            </div>
          </div>
        </form>
      </div>
    </SlideDown>
  );
};
