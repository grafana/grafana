import React from 'react';
import { shallow } from 'enzyme';
import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('should render upload button with default text and no file name', () => {
    const wrapper = shallow(<FileUpload onFileUpload={() => {}} />);
    expect(wrapper.findWhere(comp => comp.text() === 'Upload file').exists()).toBeTruthy();
    expect(wrapper.find({ 'aria-label': 'File name' }).exists()).toBeFalsy();
  });

  it("should trim uploaded file's name", () => {
    const wrapper = shallow(<FileUpload onFileUpload={() => {}} />);

    wrapper.find('input').simulate('change', {
      currentTarget: {
        files: [{ name: 'longFileName.something.png' }],
      },
    });
    expect(wrapper.find({ 'aria-label': 'File name' }).exists()).toBeTruthy();
    // Trim file name longer than 16 chars
    expect(wrapper.find({ 'aria-label': 'File name' }).text()).toEqual('longFileName.som....png');

    // Keep the name below the length limit intact
    wrapper.find('input').simulate('change', {
      currentTarget: {
        files: [{ name: 'longFileName.png' }],
      },
    });
    expect(wrapper.find({ 'aria-label': 'File name' }).text()).toEqual('longFileName.png');
  });
});
