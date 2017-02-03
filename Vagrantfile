# -*- mode: ruby -*-
# vi: set ft=ruby :

# HOW TO USE:
# -----------
# Install Vagrant + a provider (VirtualBox)
# Make sure you have an ssh agent installed (on windows, Git BASH is fine)
# Run the following from bash:
#    vagrant up
#        - This will configure and run a grafana build environment in a VM
#    vagrant ssh
#        - Connect via ssh to the build environment to perform builds/testing
#    vagrant halt
#        - Shutdown the vagrant build environment VM
#    vagrant destroy
#        - Destroy the files used by vagrant to manage the server.
# 
# The login message has a reminder of the common build commands
# these commands are further described in readme.md
# 
# NOTE: a .tmp directory is created to cache some of the files downloaded 
#       for the configuration of the environment.

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure(2) do |config|
  # Starting with one of the most common vagrant boxes available
  config.vm.box = "ubuntu/trusty64"
  
  # Expose the default grafana website through port 8080 on the local machine.
  config.vm.network "forwarded_port", :guest => 3000, :host => 8080
  
  # Configure the machine for building code and serving the site.
  # These values could be increased for comfort of development
  config.vm.provider "virtualbox" do |v|
    v.memory = 1024
    v.cpus = 2
  end

  config.ssh.forward_agent = true

  # Keeping the vagrant configuration file inline to limit the 
  # number of vagrant specific files in the repository. 
  # In future it would be nicer to expose this through a setupBuildEnv.sh
  # That could be useful for non-vagrant contributors too.
  #cmd = "bash /vagrant/setupBuildEnv.sh"
  #config.vm.provision :shell, :inline => cmd
  
  # Enable provisioning with a shell script.
  config.vm.provision "shell", privileged: false, inline: <<-SHELL

	# Download directory, so we can cache what we install as much as possible
	DOWNLOAD_DIR=/vagrant/.tmp/

	# Update package manager
	sudo apt-get update -qvagr
	# Installing basic essentials
	sudo apt-get install -y git build-essential checkinstall libssl-dev
	
	echo Getting GoLang environment
	GOLANG_PKG=go1.7.3.linux-amd64.tar.gz
	if [ ! -f $DOWNLOAD_DIR$GOLANG_PKG ]; then
		echo - downloading...
		wget -q https://storage.googleapis.com/golang/$GOLANG_PKG -P $DOWNLOAD_DIR
	fi
	sudo tar -zxvf $DOWNLOAD_DIR$GOLANG_PKG -C /usr/local/
	echo "PATH=\$PATH:/usr/local/go/bin # Add go to PATH for scripting" >> ~/.bash_profile
	source ~/.bash_profile
	
	echo Installing NVM and Node
	curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
	source ~/.nvm/nvm.sh
	nvm install 6.9
	nvm use 6.9
	nvm alias default node

	echo Installing Yarn
	npm install -g yarn
	yarn install

	echo Installing Grunt
	npm install -g grunt-cli # to do only once to install grunt command line interface
	
	echo Configuring Go workspace
	mkdir ~/.go
	echo "GOPATH=$HOME/.go" >> ~/.bash_profile
	echo "export GOPATH" >> ~/.bash_profile
	echo "PATH=\$PATH:\$GOPATH/bin # Add GOPATH/bin to PATH for scripting" >> ~/.bash_profile
	source ~/.bash_profile

	echo Linking vagrant host checkout to gopath
	mkdir -p $GOPATH/src/github.com/grafana
	ln -s /vagrant $GOPATH/src/github.com/grafana/grafana

	echo Fetching brilliant ridiculous assistant
	go get github.com/Unknwon/bra
	
	echo Updating the MOTD
	echo "#########################" >> /etc/motd
	echo "Grafana Build Environment" >> /etc/motd
    echo "#########################" >> /etc/motd
    echo "Checkout is available in two places (symlinked):" >> /etc/motd
    echo "    1) $GOPATH/src/github.com/grafana/grafana" >> /etc/motd
    echo "    2) /vagrant" >> /etc/motd
    echo " " >> /etc/motd
    echo "Common usage:" >> /etc/motd
    echo "    cd $GOPATH/src/github.com/grafana/grafana" >> /etc/motd
    echo "    go run build.go setup" >> /etc/motd
    echo "    go run build.go build" >> /etc/motd
    echo "    grunt" >> /etc/motd
    echo "    bra run" >> /etc/motd
    echo "    ./bin/grafana-server" >> /etc/motd
    echo "    grunt watch" >> /etc/motd
    echo "" >> /etc/motd
    echo "See /vagrant/readme.md for more details" >> /etc/motd
  SHELL
  
end
