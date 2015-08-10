# generator-ink-me [![Build Status](https://secure.travis-ci.org/dnnsldr/generator-ink-me.png?branch=master)](https://travis-ci.org/dnnsldr/generator-ink-me)

A [Yeoman](http://yeoman.io) generator

This is a Yeoman generator for building emails based on [Zurb Ink](http://zurb.com/ink/) templates. This also uses Grunt to add livereload, remove unused CSS and then to inline all CSS for the final build.

Email templates include:
* Basic
* Hero
* Sidebar
* Sidebar Hero
* Order Confirmation
* Shipping Confirmation
* Shopify Order Confirmation
* Shopify Shipping Confirmation

## 
## Getting Started
##

* Install: `npm install -g generator-ink-me`
* Run `yo ink-me` in the folder you wish to have your files (ex: Sites/my-email-project-folder-name)


## 
## The Generator will ask you for the following information:
##
* Choose your template
* Give your project a name -- This will be the github/bitbucket repository name
* What domain will images be hosted on
* What is the folder path on the server of the hosting provider you want to use
* What is the `public` folder path for the images on the hosting server
* What is your FTP username
* What is your FTP password
* Do you want to Litmus test 
* Litmus username **(this is conditional based on if you want litmus testing)
* Litmus password **(conditional)
* Litmus API name (in your litmus Settings -> Profile -> Subdomain for API) **(conditional)
* Choose your litmus testing clients **(conditional)

##
## Using LiveReload
##

To get started you can run `grunt` from the terminal. 

The default "grunt" will start the `watch` process for all css files and the index.html file. LiveReload is now enabled. 
Grab the [Chrome extension](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei) for LiveReload to help with ports.

##
## When Your Ready to Finalize the Files for Production
## Final Build
##

Once you are ready to package up your final build, grunt will get rid of the unused css from Ink and inline all the css, ftp your images to your image hosting provider, and run a Litmus test if you chose Litmus -

* run the command `grunt inkify` from the terminal

* This will create a copy of your index file with a reference to a newly created css file. This new css file gets rid of all of the unused css from Ink and makes a copy of the new css for reference in the copied html.

* The grunt task of 'premailer' will take the newly reference html and css and move all css inline.

* Images will be optimized

* Images will be FTP'd to your hosting provider. 

* Image relative URL's will be replaced with absolute URL's from Image Hosting Domain set during the generator.

* A test will be sent to Litmus if you choose to with the clients you define.

* Thats it. There will be a new folder called 'dist' that will have your `email-inline.html` file that is ready for use.

## Tips

* To get out of the 'Watch' when running the terminal, on MacOS click `control` and `c`. This will get your terminal back to the prompt to run new tasks.

* Make all CSS changes in the `style.css`. The `ink.css` is from the bower componenet and is pulling the lastest ink css. These files will be merged togehter and will get rid of any unused when running `grunt inkify`.

##