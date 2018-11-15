import React, { PureComponent } from 'react';
import UnitPicker from 'app/core/components/Picker/Unit/UnitPicker';

export default class TestPage extends PureComponent {
  render() {
    return (
      <div className="page-body page-container">
        <div style={{ margin: '160px auto 0', width: '500px' }}>
          <UnitPicker onSelected={() => {}} />
        </div>
      </div>
    );
  }
}
